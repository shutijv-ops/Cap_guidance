require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const Counselor = require('./models/counselors');
const Student = require('./models/students');
const Referral = require('./models/referrals');
const Setting = require('./models/settings');
const Admin = require('./models/admins');
const Leave = require('./models/leaves');
const bcrypt = require('bcryptjs');
const sgMail = require('@sendgrid/mail');
const socketIO = require('socket.io');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('[SENDGRID] API key detected and set');
} else {
  console.warn('[SENDGRID] API key not found in environment (emails will be skipped)');
}

if (!process.env.FROM_EMAIL) {
  console.warn('[SENDGRID] FROM_EMAIL not configured (messages may fail or be rejected)');
} else {
  console.log('[SENDGRID] FROM_EMAIL configured as', process.env.FROM_EMAIL);
}

// Email helper function
// Helper function to format date for email
function formatDateForEmail(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to format time for email
function formatTimeForEmail(timeStr) {
  // Convert 24-hour format to 12-hour if needed
  if (timeStr.includes(':')) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  return timeStr; // Return as is if already in desired format
}

async function sendAppointmentEmail(appt, type = 'approved') {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured - skipping email send');
    return;
  }
  
  console.log(`Preparing to send ${type} email for appointment:`, appt.refNumber);
  
  try {
    const to = appt.email;
    const formattedDate = formatDateForEmail(appt.date);
    const formattedTime = formatTimeForEmail(appt.time);
    
    let subject, statusText, additionalNote;
    
    if (type === 'rescheduled') {
      subject = `Your JRMSU Counseling Appointment has been Rescheduled - Ref ${appt.refNumber}`;
      statusText = 'rescheduled and approved';
      additionalNote = '<p><strong>Note:</strong> This appointment has been rescheduled by the guidance office. If this new schedule does not work for you, please contact us immediately.</p>';
    } else if (type === 'completed') {
      subject = `Your JRMSU Counseling Appointment has been Completed - Ref ${appt.refNumber}`;
      statusText = 'completed';
      additionalNote = '<p>Thank you for attending your counseling session. If you have follow-up concerns or need additional support, please reach out to the guidance office.</p>';
    } else {
      subject = `Your JRMSU Counseling Appointment is Approved - Ref ${appt.refNumber}`;
      statusText = 'approved';
      additionalNote = '';
    }

    const html = `
      <p>Hi ${appt.fname} ${appt.lname},</p>
      <p>Your appointment request (Reference Number: <strong>${appt.refNumber}</strong>) has been <strong>${statusText}</strong>.</p>
      <p><strong>Appointment Details:</strong></p>
      <ul>
        <li>Date: ${formattedDate}</li>
        <li>Time: ${formattedTime}</li>
        <li>Counselor: ${appt.counselor || 'Ms. Kristine Carl B. Lopez'}</li>
        <li>Venue: JRMSU Guidance Office</li>
      </ul>
      ${additionalNote}
      <p><strong>Important Notes:</strong></p>
      <ul>
        <li>Please arrive 5-10 minutes before your scheduled time</li>
        <li>Bring your school ID</li>
        <li>If you need to reschedule, please contact the guidance office at least 24 hours before</li>
      </ul>
      <p>For any questions or concerns, you can:</p>
      <ul>
        <li>Email us at guidance@jrmsu.edu.ph</li>
        <li>Call us at (065) 123-2234</li>
      </ul>
      <p>Thank you for using our online appointment system.</p>
      <p>Best regards,<br/>JRMSU Guidance Office</p>
    `;

    if (!process.env.FROM_EMAIL) {
      console.warn('FROM_EMAIL not configured - skipping email send for', appt.refNumber);
      try {
        if (typeof Notification !== 'undefined') {
          const studentName = [appt.fname, appt.mname ? appt.mname + ' ' : '', appt.lname, appt.suffix ? ' ' + appt.suffix : ''].join('').trim();
          await Notification.create({
            type: type === 'rescheduled' ? 'rescheduled' : (type === 'completed' ? 'completed' : 'approved'),
            refNumber: appt.refNumber,
            email: appt.email,
            status: 'failed',
            message: `Skipped sending email due to missing FROM_EMAIL for ${studentName}`
          });
        }
      } catch (dbErr) { console.error('Failed to create notification record (missing FROM_EMAIL):', dbErr); }
      return;
    }

    const text = `Hi ${appt.fname} ${appt.lname},\n\n` +
      `Your appointment (Ref: ${appt.refNumber}) has been ${statusText}.\n\n` +
      `Date: ${formattedDate}\nTime: ${formattedTime}\nCounselor: ${appt.counselor || 'Ms. Kristine Carl B. Lopez'}\n\n` +
      `If you have questions, reply to this message.`;

    const msg = {
      to,
      from: process.env.FROM_EMAIL,
      replyTo: process.env.REPLY_TO || process.env.FROM_EMAIL,
      subject,
      text,
      html,
      headers: {
        'X-Mailer': 'JRMSU-App/1.0'
      }
    };

    // Attempt send and capture SendGrid response for diagnostics
    let sendRes;
    try {
      sendRes = await sgMail.send(msg);
    } catch (e) {
      // rethrow to outer catch handler to record failure there
      throw e;
    }

    // Extract SendGrid message id/header if present for tracing
    let sgMessageId = null;
    let sgHeaders = null;
    try {
      if (Array.isArray(sendRes) && sendRes[0]) {
        sgHeaders = sendRes[0].headers || sendRes[0].headers;
        if (sgHeaders) sgMessageId = sgHeaders['x-message-id'] || sgHeaders['X-Message-Id'] || sgHeaders['x-msg-id'] || null;
      } else if (sendRes && sendRes.headers) {
        sgHeaders = sendRes.headers;
        sgMessageId = sgHeaders['x-message-id'] || sgHeaders['X-Message-Id'] || sgHeaders['x-msg-id'] || null;
      }
    } catch (e) { /* ignore */ }

    console.log('Approval email sent to', to, 'SendGrid statusCode:', Array.isArray(sendRes) ? (sendRes[0] && sendRes[0].statusCode) : (sendRes && sendRes.statusCode), 'messageId:', sgMessageId);
    try {
      if (typeof Notification !== 'undefined') {
        const studentName = [appt.fname, appt.mname ? appt.mname + ' ' : '', appt.lname, appt.suffix ? ' ' + appt.suffix : ''].join('').trim();
        const notif = await Notification.create({
          type: type === 'rescheduled' ? 'rescheduled' : (type === 'completed' ? 'completed' : 'approved'),
          refNumber: appt.refNumber,
          email: to,
          status: 'sent',
          message: `Email confirmation for ${studentName}'s appointment on ${formattedDate} at ${formattedTime} was sent. SendGrid status: ${Array.isArray(sendRes) ? (sendRes[0] && sendRes[0].statusCode) : (sendRes && sendRes.statusCode)}`,
          meta: { sendgrid: { messageId: sgMessageId, headers: sgHeaders } }
        });
        try { sendSseEvent('notification', notif); } catch (e) {}
      }
    } catch (dbErr) {
      console.error('Failed to create notification record (sent):', dbErr);
    }
        try {
          // record notification in DB
          if (typeof Notification !== 'undefined') {
            // Create student full name
            const studentName = [
              appt.fname,
              appt.mname ? appt.mname + ' ' : '',
              appt.lname,
              appt.suffix ? ' ' + appt.suffix : ''
            ].join('').trim();

            const notif = await Notification.create({
              type: type === 'rescheduled' ? 'rescheduled' : (type === 'completed' ? 'completed' : 'approved'),
              refNumber: appt.refNumber,
              email: to,
              status: 'sent',
              message: `Email confirmation for ${studentName}'s appointment on ${formatDateForEmail(appt.date)} at ${formatTimeForEmail(appt.time)} was successfully sent.`
            });
            // broadcast notification over SSE so admin UI can update in realtime
            try { sendSseEvent('notification', notif); } catch (e) { /* ignore SSE errors */ }
            // Also broadcast via Socket.IO so connected admin UIs receive it
            try { if (typeof broadcastUpdate === 'function') broadcastUpdate('notification', notif); } catch (e) { /* ignore */ }
          }
        } catch (dbErr) {
          console.error('Failed to create notification record (sent):', dbErr);
        }
  } catch (err) {
    console.error('Failed to send approval email:', err?.response?.body || err);
        try {
        if (typeof Notification !== 'undefined') {
          // Create student full name
          const studentName = [
            appt.fname,
            appt.mname ? appt.mname + ' ' : '',
            appt.lname,
            appt.suffix ? ' ' + appt.suffix : ''
          ].join('').trim();

          const notif = await Notification.create({
            type: type === 'rescheduled' ? 'rescheduled' : (type === 'completed' ? 'completed' : 'approved'),
            refNumber: appt.refNumber,
            email: appt.email,
            status: 'failed',
            message: `Failed to send email confirmation for ${studentName}'s appointment on ${formatDateForEmail(appt.date)} at ${formatTimeForEmail(appt.time)}. Error: ${JSON.stringify(err?.response?.body || err.message || err)}`
          });
          try { sendSseEvent('notification', notif); } catch (e) { /* ignore SSE errors */ }
          try { if (typeof broadcastUpdate === 'function') broadcastUpdate('notification', notif); } catch (e) { /* ignore */ }
        }
      } catch (dbErr2) {
        console.error('Failed to create notification record (failed):', dbErr2);
      }
  }
}

// Define Appointment Schema
const appointmentSchema = new mongoose.Schema({
  studentid: { type: String, required: true },
  fname: { type: String, required: true },
  mname: String,
  lname: { type: String, required: true },
  suffix: String,
  course: { type: String, required: true },
  year: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true },
  urgency: { type: String, required: true },
  reason: { type: String, required: true },
  date: { type: String, required: true }, // stored as yyyy-mm-dd
  time: { type: String, required: true },
  counselor: { type: String, default: null },
  refNumber: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Booked', 'Cancelled', 'Completed'] }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// ApprovedSchedule schema for mirroring approved/rescheduled appointments
const approvedScheduleSchema = new mongoose.Schema({
  date: String, // yyyy-mm-dd
  time: String, // e.g., '9:00 AM'
  status: { type: String, default: 'available', enum: ['available', 'booked'] }
});
const ApprovedSchedule = mongoose.model('ApprovedSchedule', approvedScheduleSchema);

// Notification schema for admin (tracks email send success/failure)
const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['approved','rescheduled','completed','system','other'], default: 'other' },
  refNumber: String,
  email: String,
  status: { type: String, enum: ['sent','failed'], required: true },
  read: { type: Boolean, default: false },
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

// Activity Log schema (records admin actions, login/logout, settings changes)
const activityLogSchema = new mongoose.Schema({
  actor: { type: String, default: 'admin' },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

const app = express();
const PORT = process.env.PORT || 3000;

// Use environment variable MONGODB_URI or fallback to local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to MongoDB');
  // Attempt to load persisted admin from DB (if exists)
    try {
      const existing = await Admin.findOne({}).exec();
      if (existing) {
        adminUsername = existing.username || adminUsername;
        adminEmail = existing.email || adminEmail;
        adminFirstName = existing.firstName || adminFirstName;
        adminMiddleName = existing.middleName || adminMiddleName;
        adminLastName = existing.lastName || adminLastName;
        // Migrate plaintext password to bcrypt hash if necessary
        if (existing.password) {
          const isHashed = existing.password.startsWith('$2');
          if (!isHashed) {
            const hashed = await bcrypt.hash(existing.password, 10);
            existing.password = hashed;
            await existing.save();
            adminPassword = hashed;
            console.log('[ADMIN] Migrated plaintext admin password to bcrypt hash');
          } else {
            adminPassword = existing.password;
          }
        }
        console.log('[ADMIN] Loaded admin from DB:', adminUsername);
      }
    } catch (e) {
      console.warn('[ADMIN] Failed to load admin from DB on startup', e);
    }

    // Startup cleanup: ensure legacy `counselor.leaveDates` entries without
    // corresponding `Leave` documents are pruned. This prevents deleted dates
    // from reappearing after a restart when only the legacy field remained.
    try {
      const counselorsWithLeaves = await Counselor.find({ leaveDates: { $exists: true, $ne: [] } }).exec();
      for (const c of counselorsWithLeaves) {
        const keep = [];
        for (const d of (c.leaveDates || [])) {
          const exist = await Leave.findOne({ counselor: c._id, date: d }).lean();
          if (exist) keep.push(d);
        }
        if (keep.length !== (c.leaveDates || []).length) {
          c.leaveDates = keep;
          await c.save();
          console.log(`[LEAVES] Cleaned legacy leaveDates for counselor ${c.username || c.email}: kept ${keep.length}`);
        }
      }
    } catch (e) {
      console.warn('[LEAVES] Startup cleanup failed', e);
    }

    // Remove any counselor documents that appear to be the admin (avoid admin data in counselors collection)
    // NOTE: do NOT remove counselor records that contain persisted leaveDates — preserve those so leave marks survive restarts
    try {
      const adminConditions = [];
      if (adminUsername) adminConditions.push({ username: adminUsername });
      if (adminEmail) adminConditions.push({ email: adminEmail });

      if (adminConditions.length > 0) {
        // Only delete admin-like documents that do NOT have leaveDates stored.
        const delFilter = { $and: [ { $or: adminConditions }, { $or: [ { leaveDates: { $exists: false } }, { leaveDates: { $size: 0 } } ] } ] };
        const delRes = await Counselor.deleteMany(delFilter);
        if (delRes && delRes.deletedCount) console.log('[ADMIN] Removed admin-like documents from counselors collection (no leaveDates):', delRes.deletedCount);
      }
    } catch (e) {
      console.warn('[ADMIN] Failed to clean counselors collection', e);
    }
  
  // Add test approved schedules if they don't exist
  try {
    // Test data with different times on the same date
    const testSchedules = [
      { date: "2025-11-12", time: "9:00 AM" },
      { date: "2025-11-12", time: "2:00 PM" },
      { date: "2025-11-13", time: "10:00 AM" }
    ];

    for (const schedule of testSchedules) {
      const existingSchedule = await ApprovedSchedule.findOne({
        date: schedule.date,
        time: schedule.time
      });

      if (!existingSchedule) {
        const newSchedule = new ApprovedSchedule(schedule);
        await newSchedule.save();
        console.log(`Added test approved schedule for ${schedule.date} at ${schedule.time}`);
      }
    }
  } catch (error) {
    console.error('Error adding test schedules:', error);
  }
}).catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Middleware to parse JSON bodies
// JSON parser
app.use(express.json());

// Serve admin dashboard via an explicit route that enforces authentication.
// This prevents static middleware from serving the file directly.
app.get(['/HTML/admin_dashboard.html', '/public/HTML/admin_dashboard.html'], (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    if (!isAdmin) {
      return res.redirect('/HTML/landing.html');
    }
    return res.sendFile(path.join(__dirname, 'public', 'HTML', 'admin_dashboard.html'));
  } catch (err) {
    console.warn('Error serving protected admin page', err);
    return res.redirect('/HTML/landing.html');
  }
});

// Serve other static files
app.use(express.static('public'));

// Helper to verify admin password (supports bcrypt hashes)
async function verifyAdminPassword(inputPassword) {
  if (!adminPassword) return false;
  try {
    if (typeof adminPassword === 'string' && adminPassword.startsWith('$2')) {
      return await bcrypt.compare(inputPassword, adminPassword);
    }
    return inputPassword === adminPassword;
  } catch (e) {
    console.error('[ADMIN] verifyAdminPassword error', e);
    return false;
  }
}

// Get available time slots for a specific date
app.get('/api/schedules/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const schedules = await ApprovedSchedule.find({ date });
    const appointments = await Appointment.find({ 
      date,
      status: { $in: ['Booked', 'Pending'] }
    });

    // Get all approved schedules for this date
    const approvedSchedules = await ApprovedSchedule.find({ date });
    
    // Create a map to convert 24-hour format to 12-hour format
    const timeFormatMap = {
      '09:00': '9:00 AM',
      '10:00': '10:00 AM',
      '11:00': '11:00 AM',
      '13:00': '1:00 PM',
      '14:00': '2:00 PM',
      '15:00': '3:00 PM'
    };

    // Create a map of time slots and their availability
    const bookedTimeSlots = new Map();
    approvedSchedules.forEach(schedule => {
      // Convert the 12-hour time back to 24-hour format
      const time24hr = Object.entries(timeFormatMap).find(([_, val]) => val === schedule.time)?.[0];
      if (time24hr) {
        bookedTimeSlots.set(time24hr, true);
      }
    });

    // Create all possible time slots for the day
    const defaultTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];
    const availableSlots = defaultTimes.map(time => ({
      time,
      // Only mark this specific time as booked if it exists in approved schedules
      status: bookedTimeSlots.has(time) ? 'booked' : 'available'
    }));

    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: 'Failed to fetch available time slots' });
  }
});

// Default counselor info
const DEFAULT_COUNSELOR = {
  id: 'counselor1',
  name: 'Mrs. Kristine Carl B. Lopez',
  role: 'Guidance Counselor',
  username: 'kristine.carl',
  password: 'admin123' // Note: In production, use hashed passwords
};

// In-memory storage for admin password (persists during session)
let adminPassword = DEFAULT_COUNSELOR.password;
// In-memory admin account fields (name split and email)
let adminUsername = DEFAULT_COUNSELOR.username;
let adminEmail = '';
let adminFirstName = '';
let adminMiddleName = '';
let adminLastName = '';

// Parse DEFAULT_COUNSELOR.name into components (simple heuristic)
(function parseDefaultName() {
  try {
    const parts = DEFAULT_COUNSELOR.name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return;
    // remove title if it ends with a dot or matches common titles
    const titles = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Miss', 'Mr', 'Mrs', 'Ms', 'Dr'];
    if (titles.includes(parts[0])) parts.shift();
    if (parts.length === 1) {
      adminFirstName = parts[0];
      return;
    }
    // last token is last name
    adminLastName = parts[parts.length - 1];
    // first token is first name
    adminFirstName = parts[0];
    // middle is anything in between
    if (parts.length > 2) adminMiddleName = parts.slice(1, parts.length - 1).join(' ');
  } catch (e) { /* ignore */ }
})();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Minimal CORS (allow same-origin or any for demo)
app.use((req, res, next) => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve static files from public
// Serve static files in two ways so both of these work in the browser:
//  - /HTML/appointment.html  (recommended)
//  - /public/HTML/appointment.html (matches VS Code Live Server URLs some users run)

app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Redirect root to admin dashboard for convenience
app.get('/', (req, res) => {
  // redirect root to the public landing page
  res.redirect('/HTML/landing.html');
});

// Simple health
app.get('/health', (req, res) => res.json({ ok: true }));

// Debug endpoint: report SendGrid config presence (does not leak API key)
app.get('/api/debug/sendgrid-status', (req, res) => {
  try {
    const hasKey = !!process.env.SENDGRID_API_KEY;
    const hasFrom = !!process.env.FROM_EMAIL;
    return res.json({ ok: true, sendgrid: { configured: hasKey, fromConfigured: hasFrom } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'failed' });
  }
});

// Debug: send appointment email for given ref (POST { ref: 'REF123' })
app.post('/api/debug/send-appointment-email', async (req, res) => {
  try {
    const { ref } = req.body || {};
    if (!ref) return res.status(400).json({ error: 'ref required' });

    // Find appointment by ref or _id
    let appt = await Appointment.findOne({ refNumber: ref }).lean();
    if (!appt) {
      try { appt = await Appointment.findById(ref).lean(); } catch (e) { /* ignore */ }
    }
    if (!appt) return res.status(404).json({ error: 'appointment not found' });

    // Ensure email exists
    if (!appt.email) return res.status(400).json({ error: 'appointment has no email' });

    console.log('[DEBUG] Triggering sendAppointmentEmail for', appt.refNumber, 'to', appt.email);
    try {
      await sendAppointmentEmail(appt, (req.body.type || 'approved'));
      return res.json({ ok: true, message: 'email send attempted' });
    } catch (err) {
      console.error('[DEBUG] sendAppointmentEmail failed:', err);
      return res.status(500).json({ ok: false, error: 'send failed', details: err.message || String(err) });
    }
  } catch (e) {
    console.error('Debug send-appointment-email error:', e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Debug: list recent notifications
app.get('/api/debug/notifications', async (req, res) => {
  try {
    if (typeof Notification === 'undefined') return res.json({ ok: true, notifications: [] });
    const docs = await Notification.find().sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ ok: true, notifications: docs });
  } catch (e) {
    console.error('Failed to fetch debug notifications:', e);
    return res.status(500).json({ ok: false, error: 'failed' });
  }
});

// Debug: get latest notification for a specific appointment ref
app.get('/api/debug/notification/:ref', async (req, res) => {
  try {
    const ref = req.params.ref;
    if (!ref) return res.status(400).json({ ok: false, error: 'ref required' });
    const doc = await Notification.findOne({ refNumber: ref }).sort({ createdAt: -1 }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'not found' });
    return res.json({ ok: true, notification: doc });
  } catch (e) {
    console.error('Failed to fetch debug notification by ref:', e);
    return res.status(500).json({ ok: false, error: 'failed' });
  }
});

// Get student appointments by student ID and email
app.post('/api/appointments/student', async (req, res) => {
  // Accept either `studentId` (camelCase) or `studentid` (lowercase) and match email case-insensitively
  const { studentId, email, studentid } = req.body || {};

  if (!studentId && !studentid && !email) {
    return res.status(400).json({ error: 'studentId/studentid or email is required' });
  }

  try {
    const sid = studentId || studentid || null;
    const mail = email ? String(email).trim() : null;

    // Build flexible query: prefer both sid+email, else sid-only, else email-only (case-insensitive)
    let query = {};
    // escape helper for regex
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (sid && mail) {
      // match by either student id OR email to be tolerant of mismatched fields
      query = { $or: [
        { studentid: { $regex: `^${escapeRegex(sid)}$`, $options: 'i' } },
        { email: { $regex: `^${escapeRegex(mail)}$`, $options: 'i' } }
      ] };
    } else if (sid) {
      query = { studentid: { $regex: `^${escapeRegex(sid)}$`, $options: 'i' } };
    } else if (mail) {
      query = { email: { $regex: `^${escapeRegex(mail)}$`, $options: 'i' } };
    }

    console.log('[API] Fetching student appointments with query:', JSON.stringify(query));
    const appointments = await Appointment.find(query).sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    console.error('[API] Error fetching student appointments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get appointment details by reference number
app.get('/api/appointment/:ref', async (req, res) => {
  try {
    const appointment = await mongoose.model('Appointment').findOne({ refNumber: req.params.ref });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper functions for data formatting
function capitalizeWords(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatName(str) {
  if (!str) return '';
  // Special case for names with dela, de la, etc.
  const prefixes = ['dela', 'de', 'del', 'de las', 'de los', 'san', 'santa'];
  return str.toLowerCase().split(' ')
    .map(word => {
      if (prefixes.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatAppointmentData(data) {
  return {
    ...data,
    fname: formatName(data.fname),
    mname: formatName(data.mname),
    lname: formatName(data.lname),
    suffix: (data.suffix || '').toUpperCase(),
    course: capitalizeWords(data.course),
    year: capitalizeWords(data.year),
    reason: data.reason ? data.reason.charAt(0).toUpperCase() + data.reason.slice(1) : '',
    urgency: capitalizeWords(data.urgency),
    email: (data.email || '').toLowerCase()
  };
}

// Mongoose model was moved to top of file

// SSE (Server-Sent Events) setup
const sseClients = new Set();

// Utility function to send SSE events to all connected clients
function sendSseEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      if (!client.writableEnded) {
        client.write(payload);
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      console.warn('Failed to send SSE event to client:', e);
      sseClients.delete(client);
    }
  });
}

// Start server first so static files are always available (frontend can fallback if DB is down)
const server = app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT} (http://localhost:${PORT})`);
});

// Initialize Socket.IO for real-time updates
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store connected admin clients
let adminClients = [];

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  
  socket.on('join-admin', () => {
    adminClients.push(socket.id);
    console.log(`[SOCKET] Admin joined. Total admins: ${adminClients.length}`);
    socket.emit('admin-connection', { status: 'connected' });
  });
  
  socket.on('disconnect', () => {
    adminClients = adminClients.filter(id => id !== socket.id);
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// Function to broadcast real-time updates to all connected admins
function broadcastUpdate(event, data) {
  io.emit(event, data);
}

// Server-side threshold evaluation state
let lastThresholdLevel = 0; // 0 = none, 1 = session, 2 = warning, 3 = critical

async function getPersistedThresholds() {
  try {
    const doc = await Setting.findOne({ key: 'thresholds' }).lean();
    if (doc && doc.value) return doc.value;
  } catch (e) {
    console.warn('Failed to read persisted thresholds', e);
  }
  return { sessionThreshold: 5, warningThreshold: 10, criticalThreshold: 15 };
}

// Evaluate today's appointment count against thresholds and broadcast when level changes
async function evaluateThresholds() {
  try {
    const thresholds = await getPersistedThresholds();

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const countToday = await Appointment.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });

    let level = 0;
    if (countToday >= (thresholds.criticalThreshold || 999999)) level = 3;
    else if (countToday >= (thresholds.warningThreshold || 999999)) level = 2;
    else if (countToday >= (thresholds.sessionThreshold || 999999)) level = 1;

    // Only broadcast when level changes (prevents repeated notifications)
    if (level !== lastThresholdLevel) {
      lastThresholdLevel = level;
      const payload = { level, countToday, thresholds, timestamp: new Date() };

      // Create an activity log
      try {
        const desc = level === 0 ? `Thresholds back to normal (${countToday})` : `Threshold ${level} reached: ${countToday} today`;
        const log = await ActivityLog.create({ actor: 'system', action: 'threshold-eval', details: desc });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to write threshold activity log', e); }

      // Send SSE and socket.io broadcasts
      try { sendSseEvent('threshold', payload); } catch (e) { /* ignore */ }
      try { broadcastUpdate('threshold', payload); } catch (e) { /* ignore */ }
    }

    return { level, countToday, thresholds };
  } catch (e) {
    console.error('evaluateThresholds failed', e);
    return null;
  }
}

// Admin endpoint to trigger/check thresholds immediately
app.get('/api/admin/thresholds/check', async (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    if (!isAdmin) return res.status(401).json({ error: 'Not authenticated' });

    const result = await evaluateThresholds();
    if (!result) return res.status(500).json({ error: 'evaluation failed' });
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error('threshold check endpoint error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Kick off periodic threshold evaluation every 60 seconds
setInterval(() => {
  try { evaluateThresholds(); } catch (e) { console.warn('Periodic threshold eval failed', e); }
}, 60 * 1000);

// Simple admin auth (development-only)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if(!username || !password) return res.status(400).json({ error: 'missing credentials' });

    // Try to find admin record in DB first
    try {
      const adminDoc = await Admin.findOne({ username: username.trim() }).exec();
      if (adminDoc) {
        const pwMatch = await bcrypt.compare(password, adminDoc.password).catch(()=>false);
        console.log('[ADMIN DEBUG] login attempt for', username.trim(), 'found DB admin, pwMatch:', pwMatch);
        if (pwMatch) {
          res.setHeader('Set-Cookie', [
            'admin_auth=1; Path=/; HttpOnly; SameSite=Lax',
            `admin_user=${encodeURIComponent(adminDoc.username)}; Path=/; SameSite=Lax`,
            // clear any counselor cookies from prior sessions
            'counselor_auth=; Path=/; HttpOnly; Max-Age=0',
            'counselor_user=; Path=/; Max-Age=0'
          ]);
          (async () => {
            try {
              const log = await ActivityLog.create({ actor: adminDoc.username, action: 'login', details: `Admin logged in` });
              try { sendSseEvent('activity', log); } catch (e) {}
            } catch (e) { console.warn('Failed to record admin login activity', e); }
          })();
          return res.json({ ok: true, isAdmin: true, isCounselor: false, user: { username: adminDoc.username, name: `${adminDoc.firstName || ''}${adminDoc.middleName ? ' ' + adminDoc.middleName : ''}${adminDoc.lastName ? ' ' + adminDoc.lastName : ''}`.trim(), role: adminDoc.role || DEFAULT_COUNSELOR.role } });
        }
      }
    } catch (e) {
      console.warn('[ADMIN DEBUG] error querying Admin collection', e);
    }

    // Fallback: in-memory check for legacy/default admin
    const allowedUsername = (adminUsername || DEFAULT_COUNSELOR.username).toLowerCase();
    if(username.trim().toLowerCase() === allowedUsername && password === adminPassword){
      res.setHeader('Set-Cookie', [
        'admin_auth=1; Path=/; HttpOnly; SameSite=Lax',
        `admin_user=${encodeURIComponent(adminUsername || DEFAULT_COUNSELOR.username)}; Path=/; SameSite=Lax`,
        'counselor_auth=; Path=/; HttpOnly; Max-Age=0',
        'counselor_user=; Path=/; Max-Age=0'
      ]);
      (async () => {
        try {
          const log = await ActivityLog.create({ actor: adminUsername || DEFAULT_COUNSELOR.username, action: 'login', details: `Admin logged in` });
          try { sendSseEvent('activity', log); } catch (e) {}
        } catch (e) { console.warn('Failed to record admin login activity', e); }
      })();
      const computedName = (adminFirstName || adminLastName) ? `${adminFirstName || ''}${adminMiddleName ? ' ' + adminMiddleName : ''}${adminLastName ? ' ' + adminLastName : ''}`.trim() : DEFAULT_COUNSELOR.name;
      return res.json({ ok: true, isAdmin: true, isCounselor: false, user: { username: adminUsername || DEFAULT_COUNSELOR.username, name: computedName, role: DEFAULT_COUNSELOR.role } });
    }

    return res.status(401).json({ error: 'invalid credentials' });
  } catch (err) {
    console.error('admin login error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Unified login: try admin first, then counselor
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if(!username || !password) return res.status(400).json({ error: 'missing credentials' });

    // Try admin first (DB or in-memory)
    try {
      const adminDoc = await Admin.findOne({ username: username.trim() }).exec();
      if (adminDoc) {
        const pwMatch = await bcrypt.compare(password, adminDoc.password).catch(()=>false);
        if (pwMatch) {
          res.setHeader('Set-Cookie', [
            'admin_auth=1; Path=/; HttpOnly; SameSite=Lax',
            `admin_user=${encodeURIComponent(adminDoc.username)}; Path=/; SameSite=Lax`
          ]);
          (async () => {
            try { await ActivityLog.create({ actor: adminDoc.username, action: 'login', details: `Admin logged in` }); } catch (e) {}
          })();
          return res.json({ ok: true, isAdmin: true, isCounselor: false, user: { username: adminDoc.username, name: `${adminDoc.firstName || ''}${adminDoc.middleName ? ' ' + adminDoc.middleName : ''}${adminDoc.lastName ? ' ' + adminDoc.lastName : ''}`.trim(), role: adminDoc.role || 'Admin' } });
        }
      }
    } catch (e) { console.warn('[LOGIN] error querying Admin collection', e); }

    // Fallback in-memory admin check
    const allowedUsername = (adminUsername || DEFAULT_COUNSELOR.username).toLowerCase();
    if(username.trim().toLowerCase() === allowedUsername && password === adminPassword){
      res.setHeader('Set-Cookie', 'admin_auth=1; Path=/; HttpOnly; SameSite=Lax');
      (async () => { try { await ActivityLog.create({ actor: adminUsername || DEFAULT_COUNSELOR.username, action: 'login', details: `Admin logged in` }); } catch (e) {} })();
      const computedName = (adminFirstName || adminLastName) ? `${adminFirstName || ''}${adminMiddleName ? ' ' + adminMiddleName : ''}${adminLastName ? ' ' + adminLastName : ''}`.trim() : DEFAULT_COUNSELOR.name;
      return res.json({ ok: true, isAdmin: true, isCounselor: false, user: { username: adminUsername || DEFAULT_COUNSELOR.username, name: computedName, role: DEFAULT_COUNSELOR.role || 'Admin' } });
    }

    // Try counselor collection
    try {
      const c = await Counselor.findOne({ username: username.trim() }).exec();
      if (c) {
        // Support both plaintext and bcrypt hashes for counselor password
        let ok = false;
        try {
          if (typeof c.password === 'string' && c.password.startsWith('$2')) {
            ok = await bcrypt.compare(password, c.password).catch(()=>false);
          } else {
            ok = password === c.password;
          }
        } catch (e) { ok = false; }

        if (ok) {
          // Only allow active counselors
          if (c.status && c.status !== 'Active') {
            return res.status(403).json({ error: 'counselor not active' });
          }
          res.setHeader('Set-Cookie', [
            'counselor_auth=1; Path=/; HttpOnly; SameSite=Lax',
            `counselor_user=${encodeURIComponent(c.username)}; Path=/; SameSite=Lax`,
            // clear any admin cookies from prior sessions
            'admin_auth=; Path=/; HttpOnly; Max-Age=0',
            'admin_user=; Path=/; Max-Age=0'
          ]);
          (async () => { try { await ActivityLog.create({ actor: c.username, action: 'login', details: `Counselor logged in` }); } catch (e) {} })();
          return res.json({ ok: true, isAdmin: false, isCounselor: true, user: { username: c.username, name: `${c.firstName || ''}${c.middleName ? ' ' + c.middleName : ''}${c.lastName ? ' ' + c.lastName : ''}`.trim(), role: c.role || 'Counselor' } });
        }
      }
    } catch (e) { console.warn('[LOGIN] error querying Counselor collection', e); }

    return res.status(401).json({ error: 'invalid credentials' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Serve counselor dashboard via protected route
app.get(['/HTML/counselor_dashboard.html', '/public/HTML/counselor_dashboard.html'], (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isCounselor = cookie.split(';').map(s => s.trim()).includes('counselor_auth=1');
    if (!isCounselor) {
      return res.redirect('/HTML/landing.html');
    }
    return res.sendFile(path.join(__dirname, 'public', 'HTML', 'counselor_dashboard.html'));
  } catch (err) {
    console.warn('Error serving protected counselor page', err);
    return res.redirect('/HTML/landing.html');
  }
});

// Admin change password endpoint
app.post('/api/admin/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify admin is authenticated
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    console.log('[ADMIN DEBUG] update-account cookie present:', !!cookie, 'isAdmin:', isAdmin);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify old password using bcrypt-aware helper
    const okOld = await verifyAdminPassword(oldPassword);
    if (!okOld) {
      console.log('[ADMIN DEBUG] password mismatch for change-password');
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    adminPassword = newPassword;

    // log change-password activity
    (async () => {
      try {
        const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'change-password', details: 'Admin changed password' });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record change-password activity', e); }
    })();

    // Persist password change to Admin collection as well
    try {
      const filter = { username: adminUsername || DEFAULT_COUNSELOR.username };
      await Admin.findOneAndUpdate(filter, { password: adminPassword, username: adminUsername || DEFAULT_COUNSELOR.username }, { upsert: true, new: true, setDefaultsOnInsert: true });
      console.log('[ADMIN] Persisted password change to DB for', filter.username);
    } catch (e) {
      console.warn('[ADMIN] Failed to persist password change to DB', e);
    }

    return res.json({
      ok: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update admin account (password and/or username)
app.post('/api/admin/update-account', async (req, res) => {
  try {
    const { oldPassword, newPassword, newUsername, newFirstName, newMiddleName, newLastName, newEmail } = req.body;

    if (!oldPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    if (!newPassword && !newUsername && !newFirstName && !newEmail && !newMiddleName && !newLastName) {
      return res.status(400).json({ error: 'Please provide at least one field to update' });
    }

    // Verify admin by cookie OR by providing correct current password
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    const okOldPwd = await verifyAdminPassword(oldPassword);
    if (!isAdmin && !okOldPwd) {
      return res.status(401).json({ error: 'Not authenticated or current password is incorrect' });
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      adminPassword = hashed;
      console.log('[ADMIN] Password updated (hashed)');
    }

    // Update username if provided
    if (newUsername) {
      if (newUsername.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      adminUsername = newUsername;
      console.log('[ADMIN] Username updated to:', newUsername);
      (async () => {
        try {
          const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'update-account', details: `Updated username to ${newUsername}` });
          try { sendSseEvent('activity', log); } catch (e) {}
        } catch (e) { console.warn('Failed to record update-account activity', e); }
      })();
    }

    // Capture previous username for DB lookup
    const prevUsernameForDb = adminUsername || DEFAULT_COUNSELOR.username;

    // Update name/email fields if provided
    let nameChanged = false;
    if (newFirstName) { adminFirstName = newFirstName; nameChanged = true; }
    if (newMiddleName !== undefined) { adminMiddleName = newMiddleName || ''; nameChanged = true; }
    if (newLastName) { adminLastName = newLastName; nameChanged = true; }
    if (newEmail !== undefined) { adminEmail = newEmail || ''; }

    if (nameChanged) {
      (async () => {
        try {
          const name = `${adminFirstName} ${adminMiddleName ? adminMiddleName + ' ' : ''}${adminLastName}`.trim();
          const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'update-account', details: `Updated admin name to ${name}` });
          try { sendSseEvent('activity', log); } catch (e) {}
        } catch (e) { console.warn('Failed to record update-account activity', e); }
      })();
    }

    // Persist admin changes to DB (create or update)
    try {
      await Admin.findOneAndUpdate(
        { username: prevUsernameForDb },
        {
          username: adminUsername || prevUsernameForDb,
          password: adminPassword,
          firstName: adminFirstName,
          middleName: adminMiddleName,
          lastName: adminLastName,
          email: adminEmail,
          role: 'Administrator',
          updatedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('[ADMIN] Persisted admin changes to DB');
    } catch (e) {
      console.warn('[ADMIN] Failed to persist admin changes to DB', e);
    }

    return res.json({
      ok: true,
      message: 'Account updated successfully'
    });
  } catch (error) {
    console.error('Admin update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// ========== COUNSELOR PROFILE ENDPOINTS ==========
// Get counselor profile
app.get('/api/counselor/profile', async (req, res) => {
  try {
    // Prefer identifying the counselor from the counselor_user cookie (set at login)
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(s => s.trim()).filter(Boolean).reduce((acc, cur) => {
      const idx = cur.indexOf('=');
      if (idx === -1) return acc;
      const k = cur.slice(0, idx).trim();
      const v = cur.slice(idx + 1).trim();
      acc[k] = v;
      return acc;
    }, {});
    const counselorUsername = cookies['counselor_user'] ? decodeURIComponent(cookies['counselor_user']) : null;

    let counselor = null;
    if (counselorUsername) {
      counselor = await Counselor.findOne({ username: counselorUsername }).select('-password');
    }
    // Fallback: return first counselor if cookie missing or lookup fails
    if (!counselor) counselor = await Counselor.findOne().select('-password');
    
    if (!counselor) {
      return res.status(404).json({ success: false, error: 'Counselor not found' });
    }

    res.json({
      success: true,
      counselor: {
        title: counselor.title,
        firstName: counselor.firstName,
        middleName: counselor.middleName,
        lastName: counselor.lastName,
        email: counselor.email,
        username: counselor.username,
        role: counselor.role,
        status: counselor.status
      }
    });
  } catch (error) {
    console.error('Error fetching counselor profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Update counselor profile
app.post('/api/counselor/update-profile', async (req, res) => {
  try {
    const { title, firstName, middleName, lastName, email } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Identify counselor by cookie if available
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(s => s.trim()).filter(Boolean).reduce((acc, cur) => {
      const idx = cur.indexOf('=');
      if (idx === -1) return acc;
      const k = cur.slice(0, idx).trim();
      const v = cur.slice(idx + 1).trim();
      acc[k] = v;
      return acc;
    }, {});
    const counselorUsername = cookies['counselor_user'] ? decodeURIComponent(cookies['counselor_user']) : null;

    const filter = counselorUsername ? { username: counselorUsername } : {};
    const counselor = await Counselor.findOneAndUpdate(
      filter,
      {
        title: title || 'Ms.',
        firstName,
        middleName: middleName || '',
        lastName,
        email
      },
      { new: true }
    ).select('-password');

    if (!counselor) {
      return res.status(404).json({ error: 'Counselor not found' });
    }

    console.log('[COUNSELOR] Profile updated for:', counselor.firstName, counselor.lastName);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      counselor: {
        title: counselor.title,
        firstName: counselor.firstName,
        middleName: counselor.middleName,
        lastName: counselor.lastName,
        email: counselor.email
      }
    });
  } catch (error) {
    console.error('Error updating counselor profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change counselor username (requires current counselor password)
app.post('/api/counselor/change-username', async (req, res) => {
  try {
    const { oldPassword, newUsername } = req.body;
    if (!oldPassword || !newUsername) return res.status(400).json({ error: 'oldPassword and newUsername required' });

    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(s => s.trim()).filter(Boolean).reduce((acc, cur) => {
      const idx = cur.indexOf('=');
      if (idx === -1) return acc;
      const k = cur.slice(0, idx).trim();
      const v = cur.slice(idx + 1).trim();
      acc[k] = v;
      return acc;
    }, {});
    const counselorUsername = cookies['counselor_user'] ? decodeURIComponent(cookies['counselor_user']) : null;
    if (!counselorUsername) return res.status(401).json({ error: 'Not authenticated' });

    const counselor = await Counselor.findOne({ username: counselorUsername });
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });

    // Verify password (bcrypt or plain)
    const ok = (async () => {
      try {
        if (typeof counselor.password === 'string' && counselor.password.startsWith('$2')) return await bcrypt.compare(oldPassword, counselor.password);
        return oldPassword === counselor.password;
      } catch (e) { return false; }
    })();

    if (!(await ok)) return res.status(401).json({ error: 'Not authenticated or current password is incorrect' });

    // Update username (ensure unique)
    const exists = await Counselor.findOne({ username: newUsername });
    if (exists) return res.status(400).json({ error: 'Username already taken' });

    counselor.username = newUsername;
    await counselor.save();

    // Set cookie so client sees updated username
    res.setHeader('Set-Cookie', `counselor_user=${encodeURIComponent(newUsername)}; Path=/; SameSite=Lax`);

    return res.json({ ok: true, message: 'Username changed', username: newUsername });
  } catch (error) {
    console.error('Error changing counselor username:', error);
    return res.status(500).json({ error: 'Failed to change username' });
  }
});

// Change counselor password
app.post('/api/counselor/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });

    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(s => s.trim()).filter(Boolean).reduce((acc, cur) => {
      const idx = cur.indexOf('=');
      if (idx === -1) return acc;
      const k = cur.slice(0, idx).trim();
      const v = cur.slice(idx + 1).trim();
      acc[k] = v;
      return acc;
    }, {});
    const counselorUsername = cookies['counselor_user'] ? decodeURIComponent(cookies['counselor_user']) : null;
    if (!counselorUsername) return res.status(401).json({ error: 'Not authenticated' });

    const counselor = await Counselor.findOne({ username: counselorUsername });
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });

    // Verify current password
    let ok = false;
    try {
      if (typeof counselor.password === 'string' && counselor.password.startsWith('$2')) ok = await bcrypt.compare(oldPassword, counselor.password);
      else ok = oldPassword === counselor.password;
    } catch (e) { ok = false; }

    if (!ok) return res.status(401).json({ error: 'Not authenticated or current password is incorrect' });

    // Update password (store bcrypt hash)
    const hashed = await bcrypt.hash(newPassword, 10);
    counselor.password = hashed;
    await counselor.save();

    return res.json({ ok: true, message: 'Password changed' });
  } catch (error) {
    console.error('Error changing counselor password:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// Student login endpoint
app.post('/api/student/login', async (req, res) => {
  try {
    const { schoolId, password } = req.body;

    if (!schoolId || !password) {
      return res.status(400).json({ error: 'School ID and password are required' });
    }

    // Find student by school ID
    const student = await Student.findOne({ schoolId: schoolId.trim() });
    
    if (!student) {
      return res.status(401).json({ error: 'Invalid school ID or password' });
    }

    // Compare password
    const isPasswordValid = await student.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid school ID or password' });
    }

    // Return student data (without password)
    // Record student login activity (fire-and-forget)
    (async () => {
      try {
        const actorId = student.schoolId || String(student._id);
        const log = await ActivityLog.create({ actor: actorId, action: 'login', details: `Student logged in (${actorId})`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record student login activity', e); }
    })();

    return res.json({
      ok: true,
      student: {
        id: student._id,
        schoolId: student.schoolId,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        suffix: student.suffix,
        email: student.email,
        course: student.course,
        year: student.year,
        contact: student.contact,
        fullName: student.fullName,
        passwordChanged: student.passwordChanged,
        status: student.status
      }
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Student logout endpoint (records activity)
app.post('/api/student/logout', async (req, res) => {
  try {
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId required' });
    (async () => {
      try {
        const log = await ActivityLog.create({ actor: studentId, action: 'logout', details: `Student logged out (${studentId})`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record student logout activity', e); }
    })();
    return res.json({ ok: true });
  } catch (err) {
    console.error('student logout error', err);
    return res.status(500).json({ error: 'failed' });
  }
});

// Student change password endpoint
app.post('/api/student/change-password', async (req, res) => {
  try {
    const { studentId, oldPassword, newPassword } = req.body;

    if (!studentId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find student by ID
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(401).json({ error: 'Student not found' });
    }

    // Verify old password
    const isPasswordValid = await student.comparePassword(oldPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    student.password = newPassword; // Will be hashed by pre-save hook
    student.passwordChanged = true;
    await student.save();

    // Record student password change activity
    (async () => {
      try {
        const actorId = student.schoolId || String(student._id);
        const log = await ActivityLog.create({ actor: actorId, action: 'change-password', details: `Student changed password (${actorId})`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record student change-password activity', e); }
    })();

    return res.json({ ok: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Check admin authentication
app.get('/api/counselors', async (req, res) => {
  try {
    const counselors = await Counselor.find().select('-password');
    res.json(counselors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch counselors' });
  }
});

app.post('/api/counselors', async (req, res) => {
  try {
    const { title, firstName, middleName, lastName, email, username, password, role } = req.body;
    // Prevent creating a counselor record that matches the admin account
    try {
      if (username) {
        const existingAdmin = await Admin.findOne({ $or: [ { username: username }, { email: email } ] }).lean();
        if (existingAdmin) {
          return res.status(403).json({ error: 'Cannot create counselor with admin username/email' });
        }
      }
    } catch (chkErr) {
      console.warn('Admin check failed during counselor create:', chkErr);
    }
    const counselor = new Counselor({
      title, firstName, middleName, lastName, email, username, password, role
    });
    await counselor.save();
    const { password: _, ...counselorData } = counselor.toObject();
    // record activity: admin created a counselor
    (async () => {
      try {
        const actor = DEFAULT_COUNSELOR.username || 'admin';
        const log = await ActivityLog.create({ actor, action: 'create-counselor', details: `Created counselor ${counselor.email || counselor.username}`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record create-counselor activity', e); }
    })();
    res.status(201).json(counselorData);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create counselor' });
    }
  }
});

app.put('/api/counselors/:id', async (req, res) => {
  try {
    const { title, firstName, middleName, lastName, email, status } = req.body;
    const counselor = await Counselor.findByIdAndUpdate(
      req.params.id,
      { title, firstName, middleName, lastName, email, status },
      { new: true }
    ).select('-password');
    if (!counselor) {
      return res.status(404).json({ error: 'Counselor not found' });
    }
    res.json(counselor);
    // record counselor profile update activity
    (async () => {
      try {
        const name = `${counselor.firstName || ''} ${counselor.lastName || ''}`.trim() || counselor.email || 'Counselor';
        const notif = await Notification.create({ type: 'system', status: 'sent', message: `Counselor profile updated: ${name}`, email: '' });
        try { sendSseEvent('notification', notif); } catch (e) {}
        // also record activity log for counselor update
        try {
          const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'update-counselor', details: `Updated counselor ${name}`, ip: req.ip });
          try { sendSseEvent('activity', log); } catch (e) {}
        } catch (e) { console.warn('Failed to record update-counselor activity', e); }
      } catch (e) { console.warn('Failed to record counselor update notification', e); }
    })();
  } catch (error) {
    res.status(500).json({ error: 'Failed to update counselor' });
  }
});

// Get counselor info
app.get('/api/counselor', (req, res) => {
  res.json({
    name: DEFAULT_COUNSELOR.name,
    role: DEFAULT_COUNSELOR.role,
    id: DEFAULT_COUNSELOR.id
  });
});

app.get('/api/admin/check', async (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s=>s.trim()).includes('admin_auth=1');
    if (!isAdmin) return res.status(401).json({ ok: false });

    // Prefer persisted Admin document from DB when available
    try {
      const adminDoc = await Admin.findOne({}).lean();
      if (adminDoc) {
        return res.json({ ok: true, user: {
          username: adminDoc.username || adminUsername || DEFAULT_COUNSELOR.username,
          firstName: adminDoc.firstName || '',
          middleName: adminDoc.middleName || '',
          lastName: adminDoc.lastName || '',
          email: adminDoc.email || '',
          role: adminDoc.role || 'Administrator'
        }});
      }
    } catch (dbErr) {
      console.warn('Error reading Admin from DB in /api/admin/check:', dbErr);
    }

    // Fallback to in-memory admin values if no DB record
    return res.json({ ok: true, user: {
      username: adminUsername || DEFAULT_COUNSELOR.username,
      firstName: adminFirstName || '',
      middleName: adminMiddleName || '',
      lastName: adminLastName || '',
      email: adminEmail || ''
    }});
  } catch (e) {
    console.error('/api/admin/check error', e);
    return res.status(500).json({ ok: false });
  }
});

// Who am I — return user info for admin or counselor based on cookies
app.get('/api/me', async (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const parts = cookie.split(';').map(s => s.trim()).filter(Boolean);
    const isAdmin = parts.includes('admin_auth=1') || parts.some(p => p.startsWith('admin_auth='));
    if (isAdmin) {
      // determine username from admin_user cookie if present
      const adminUserPart = parts.find(p => p.startsWith('admin_user='));
      const username = adminUserPart ? decodeURIComponent(adminUserPart.split('=')[1]) : (adminUsername || DEFAULT_COUNSELOR.username);
      const name = (adminFirstName || adminLastName) ? `${adminFirstName || ''}${adminMiddleName ? ' ' + adminMiddleName : ''}${adminLastName ? ' ' + adminLastName : ''}`.trim() : DEFAULT_COUNSELOR.name;
      return res.json({ ok: true, user: { username, name, role: 'Admin' } });
    }

    const isCounselor = parts.includes('counselor_auth=1') || parts.some(p => p.startsWith('counselor_auth='));
    if (isCounselor) {
      const cUserPart = parts.find(p => p.startsWith('counselor_user='));
      const username = cUserPart ? decodeURIComponent(cUserPart.split('=')[1]) : null;
      if (!username) return res.status(200).json({ ok: false });
      const c = await Counselor.findOne({ username }).select('-password').lean();
      if (!c) return res.status(404).json({ error: 'counselor not found' });
      const name = `${c.title || ''} ${c.firstName || ''}${c.middleName ? ' ' + c.middleName : ''} ${c.lastName || ''}`.trim();
      return res.json({ ok: true, user: { username: c.username, name, role: c.role || 'Counselor' } });
    }

    return res.status(401).json({ ok: false });
  } catch (e) {
    console.error('/api/me error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin: get thresholds (persistent)
app.get('/api/admin/thresholds', async (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s=>s.trim()).includes('admin_auth=1');
    if(!isAdmin) return res.status(401).json({ error: 'Not authenticated' });

    const doc = await Setting.findOne({ key: 'thresholds' }).lean();
    if (!doc) {
      // return defaults matching client defaults
      return res.json({ thresholds: { sessionThreshold: 5, warningThreshold: 10, criticalThreshold: 15 } });
    }
    return res.json({ thresholds: doc.value });
  } catch (e) {
    console.error('Failed to get thresholds', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Admin: save thresholds
app.post('/api/admin/thresholds', async (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s=>s.trim()).includes('admin_auth=1');
    if(!isAdmin) return res.status(401).json({ error: 'Not authenticated' });

    const { sessionThreshold, warningThreshold, criticalThreshold } = req.body || {};
    if (!sessionThreshold || !warningThreshold || !criticalThreshold) return res.status(400).json({ error: 'missing values' });

    const value = { sessionThreshold: parseInt(sessionThreshold,10), warningThreshold: parseInt(warningThreshold,10), criticalThreshold: parseInt(criticalThreshold,10) };
    const updated = await Setting.findOneAndUpdate({ key: 'thresholds' }, { value, updatedAt: new Date() }, { upsert: true, new: true });

    // Broadcast update to admin clients if socket exists
    try { if (typeof broadcastUpdate === 'function') broadcastUpdate('thresholds-updated', value); } catch(e){}

    res.json({ ok: true, thresholds: updated.value });
  } catch (e) {
    console.error('Failed to save thresholds', e);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  // clear cookies
  res.setHeader('Set-Cookie', [
    'admin_auth=; Path=/; HttpOnly; Max-Age=0',
    'admin_user=; Path=/; Max-Age=0'
  ]);
  // record logout activity
  (async () => {
    try {
      const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'logout', details: 'Admin logged out' });
      try { sendSseEvent('activity', log); } catch (e) {}
    } catch (e) { console.warn('Failed to record admin logout activity', e); }
  })();
  res.json({ ok: true });
});

// Generic logout endpoint - clears any auth cookies (admin or counselor)
app.post('/api/logout', (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const parts = cookie.split(';').map(s => s.trim()).filter(Boolean);
    let actor = 'system';
    const adminUserPart = parts.find(p => p.startsWith('admin_user='));
    const counselorUserPart = parts.find(p => p.startsWith('counselor_user='));
    if (adminUserPart) actor = decodeURIComponent(adminUserPart.split('=')[1]);
    else if (counselorUserPart) actor = decodeURIComponent(counselorUserPart.split('=')[1]);

    // clear both admin and counselor cookies
    res.setHeader('Set-Cookie', [
      'admin_auth=; Path=/; HttpOnly; Max-Age=0',
      'admin_user=; Path=/; Max-Age=0',
      'counselor_auth=; Path=/; HttpOnly; Max-Age=0',
      'counselor_user=; Path=/; Max-Age=0'
    ]);

    (async () => {
      try {
        await ActivityLog.create({ actor: actor || 'user', action: 'logout', details: `${actor} logged out` });
        try { sendSseEvent('activity', { actor, action: 'logout' }); } catch (e) {}
      } catch (e) { /* ignore */ }
    })();

    return res.json({ ok: true });
  } catch (e) {
    console.error('/api/logout error', e);
    return res.status(500).json({ error: 'failed' });
  }
});

// SSE endpoint
app.get('/api/notifications/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial heartbeat
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  
  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    res.write(':\n\n'); // heartbeat
  }, 30000);
  
  sseClients.add(res);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Utility function to send SSE event
function sendSseEvent(eventType, data) {
  sseClients.forEach(client => {
    try {
      if (!client.writableEnded) {
        client.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      console.warn('Failed to send SSE event to client:', e);
      sseClients.delete(client);
    }
  });
}

// API: get booked slots for a date
app.get('/api/bookedSlots', async (req, res) => {
  const date = req.query.date; // expected yyyy-mm-dd
  if(!date) return res.status(400).json({ error: 'date is required' });
  try{
    // If MongoDB isn't connected, return an empty booked list so the client can fallback to demo data
    if(mongoose.connection.readyState !== 1){
      return res.json({ booked: [] });
    }
  const docs = await ApprovedSchedule.find({ date }).select('time -_id').lean();
  // Log for debugging
  console.log('Booked slots (ApprovedSchedule) for', date, ':', docs);
  // Deduplicate and normalize times
  const booked = Array.from(new Set(docs.map(d => (d.time || '').trim().toLowerCase())));
  res.json({ booked });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// SSE stream for admin dashboards to receive realtime appointment events
// API: student requests new appointment
app.post('/api/appointments/request', async (req, res) => {
  const { 
    studentid,
    fname,
    mname,
    lname,
    suffix,
    course,
    year,
    contact,
    email,
    date,
    time,
    reason,
    urgency
  } = req.body;
  
  if (!studentid || !fname || !lname || !course || !year || !contact || !email || !date || !time || !reason || !urgency) {
    return res.status(400).json({ error: 'All required fields must be filled.' });
  }
  // Generate ref number
  const refNumber = 'JR' + Date.now().toString(36).toUpperCase().slice(-8);
  try {
    console.log('Processing appointment request:', { date, time, urgency });
    // Convert 24-hour time to 12-hour format for checking
    const timeFormatMap = {
      '09:00': '9:00 AM',
      '10:00': '10:00 AM',
      '11:00': '11:00 AM',
      '13:00': '1:00 PM',
      '14:00': '2:00 PM',
      '15:00': '3:00 PM'
    };
    
    if (!timeFormatMap[time]) {
      return res.status(400).json({ error: `Invalid time slot: ${time}. Valid times are: ${Object.keys(timeFormatMap).join(', ')}` });
    }
    
    // Check if this specific time slot is approved/booked
    const approvedSlot = await ApprovedSchedule.findOne({
      date: date,
      time: timeFormatMap[time] // Convert 24-hour time to 12-hour format
    });
    
    if (approvedSlot) {
      return res.status(409).json({ 
        error: `The time slot ${timeFormatMap[time]} on ${date} is not available` 
      });
    }

    // Check if there's an existing appointment for this slot
    const existingAppointment = await Appointment.findOne({
      date,
      time,
      status: { $in: ['Booked', 'Pending'] }
    });

    if (existingAppointment) {
      return res.status(409).json({ error: 'This time slot is already taken' });
    }

    let status = 'Pending';
    let apptDate = date;
    let apptTime = time;
    
    if (urgency === 'Crisis') {
      // Auto-schedule for today, status booked
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      apptDate = `${yyyy}-${mm}-${dd}`;
      apptTime = '09:00';
      status = 'Booked';
    }
    // Check for double booking (except for crisis, which is always auto-booked)
    if (urgency !== 'Crisis') {
      const existing = await Appointment.findOne({ date: apptDate, time: apptTime, status: 'booked' });
      if (existing) {
        return res.status(409).json({ error: 'Time slot already booked', existingRef: existing.refNumber });
      }
    }
    // Create appointment
    const appt = new Appointment({
      studentid,
      fname,
      mname,
      lname,
      suffix,
      course,
      year,
      contact,
      email,
      date: apptDate,
      time: apptTime,
      reason,
      urgency,
      refNumber,
      status
    });

    try {
      await appt.save();
      console.log('Appointment saved successfully:', { refNumber, status });
      sendSseEvent('appointment', appt);
      // record activity: student requested appointment
      (async () => {
        try {
          const actor = studentid || (appt.studentid) || (email || 'student');
          const log = await ActivityLog.create({ actor, action: 'request-appointment', details: `Requested appointment ${refNumber} for ${date} ${time}`, ip: req.ip });
          try { sendSseEvent('activity', log); } catch (e) {}
        } catch (e) { console.warn('Failed to record request-appointment activity', e); }
      })();
      
      // Send confirmation email to student
      try {
        const confirmationHtml = `
          <p>Hi ${fname} ${lname},</p>
          <p>Thank you for submitting your appointment request with JRMSU Guidance Office.</p>
          <p><strong>Request Details:</strong></p>
          <ul>
            <li>Reference Number: <strong>${refNumber}</strong></li>
            <li>Requested Date: ${formatDateForEmail(apptDate)}</li>
            <li>Requested Time: ${formatTimeForEmail(apptTime)}</li>
            <li>Reason: ${reason}</li>
            <li>Urgency Level: ${urgency}</li>
          </ul>
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Your request will be reviewed by the guidance office</li>
            <li>You will receive an email once your appointment is approved</li>
            <li>Please ensure your email is correct so we can contact you</li>
          </ul>
          <p>If you need to cancel or modify your request, please contact the guidance office:</p>
          <ul>
            <li>Email: guidance@jrmsu.edu.ph</li>
            <li>Phone: (065) 123-2234</li>
          </ul>
          <p>Thank you for using our online appointment system.</p>
          <p>Best regards,<br/>JRMSU Guidance Office</p>
        `;
        
        const msg = {
          to: email,
          from: process.env.FROM_EMAIL,
          subject: `Appointment Request Received - Ref ${refNumber}`,
          html: confirmationHtml
        };
        
        await sgMail.send(msg);
        console.log('Confirmation email sent to', email);
      } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr);
        // Don't fail the appointment creation if email fails
      }
      
      res.json({ ok: true, refNumber });
    } catch (saveErr) {
      console.error('Error saving appointment:', saveErr);
      if (saveErr.name === 'ValidationError') {
        res.status(400).json({ error: 'Invalid appointment data: ' + Object.values(saveErr.errors).map(e => e.message).join(', ') });
      } else {
        res.status(500).json({ error: 'Failed to save appointment' });
      }
    }
  } catch (err) {
    console.error('Error processing appointment request:', err);
    res.status(500).json({ error: err.message || 'Server error creating appointment' });
  }
});
// SSE endpoint for notifications
app.get('/api/notifications/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial heartbeat
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  
  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    res.write(':\n\n'); // heartbeat
  }, 30000);
  
  sseClients.add(res);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// API: create appointment
app.post('/api/appointments', async (req, res) => {
  const body = req.body || {};
  // basic validation
  if(!body.fname || !body.lname || !body.studentid){
    return res.status(400).json({ error: 'missing required fields' });
  }

  // generate ref
  const ref = (body.refNumber) || ('JR' + Date.now().toString(36).toUpperCase().slice(-8));

  try{
    // Format the appointment data
    const formattedData = formatAppointmentData(body);
    
    if(mongoose.connection.readyState !== 1){
      console.warn('MongoDB not connected — returning ref but not persisting appointment');
      const payload = { ...formattedData, refNumber: ref, createdAt: new Date().toISOString(), saved: false };
      // broadcast to SSE clients so admin sees new request even if not persisted
      sendSseEvent('appointment', payload);
      return res.json({ ok: true, refNumber: ref, saved: false });
    }

    // Duplication/conflict check: prevent creating appointment in an already-approved/booked slot
    if (formattedData.date && formattedData.time) {
      // Normalize a possible HH:MM -> h:mm AM/PM for checking ApprovedSchedule
      function to12hr(t) {
        try {
          if (!t) return t;
          const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return String(t).trim();
          let h = parseInt(m[1], 10);
          const mm = m[2];
          const ap = h >= 12 ? 'PM' : 'AM';
          if (h === 0) h = 12;
          if (h > 12) h = h - 12;
          return `${h}:${mm} ${ap}`;
        } catch (e) { return String(t).trim(); }
      }

      const time12 = to12hr(formattedData.time);

      // Check ApprovedSchedule for pre-existing approved slot
      const schedConflict = await ApprovedSchedule.findOne({ date: formattedData.date, time: { $in: [formattedData.time, time12] } }).lean();
      if (schedConflict) {
        return res.status(409).json({ error: 'Time slot already booked (approved schedule)', existingRef: null });
      }

      // Check other appointments that are already approved/booked (case variations)
      const approvedStatuses = ['Approved','approved','rescheduled/approved','Rescheduled/Approved','Booked','booked'];
      const existing = await Appointment.findOne({ 
        date: formattedData.date, 
        time: { $in: [formattedData.time, time12] },
        status: { $in: approvedStatuses }
      }).lean();
      if (existing) {
        return res.status(409).json({ error: 'Time slot already booked', existingRef: existing.refNumber });
      }
    }

    const appt = new Appointment({ ...formattedData, refNumber: ref });
    await appt.save();
    // If appointment is created already approved/rescheduled, mirror into ApprovedSchedule
    if(['approved', 'rescheduled/approved'].includes((appt.status || '').toLowerCase())){
      try{
        await ApprovedSchedule.updateOne(
          { date: appt.date, time: appt.time },
          { $set: { date: appt.date, time: appt.time } },
          { upsert: true }
        );
      }catch(e){ console.error('Failed to upsert ApprovedSchedule on create:', e); }
    }
    const payload = { ...formattedData, refNumber: ref, createdAt: appt.createdAt, saved: true };
    // broadcast to SSE clients
    sendSseEvent('appointment', payload);
    // record activity: admin created appointment
    (async () => {
      try {
        const actor = DEFAULT_COUNSELOR.username || 'admin';
        const log = await ActivityLog.create({ actor, action: 'create-appointment', details: `Created appointment ${ref} for ${formattedData.studentid || formattedData.fname}`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record create-appointment activity', e); }
    })();
    // Broadcast to real-time WebSocket clients
    broadcastUpdate('appointment-created', { 
      refNumber: ref, 
      studentid: appt.studentid,
      date: appt.date,
      time: appt.time,
      status: appt.status,
      urgency: appt.urgency,
      fname: appt.fname,
      lname: appt.lname
    });
    res.json({ ok: true, refNumber: ref, appointment: appt, saved: true });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'failed to save' });
  }
});

// Update appointment (assign counselor, change status)
app.put('/api/appointments/:ref', async (req, res) => {
  const ref = req.params.ref;
  const body = req.body || {};
  try{
    console.log('Processing appointment update:', { ref, body });
    
    if(mongoose.connection.readyState !== 1){
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Format any incoming data that needs capitalization
    const formattedData = formatAppointmentData(body);
    const update = {};
    if(body.status) update.status = body.status;
    if(body.date) update.date = formattedData.date || body.date;
    if(body.time) update.time = formattedData.time || body.time;
    if(body.counselor) update.counselor = body.counselor;
    if(Object.keys(update).length === 0) return res.status(400).json({ error: 'nothing to update' });

    console.log('Update data:', update);

    

    // Try to find by refNumber first, then by _id
    let prior = await Appointment.findOne({ refNumber: ref }).lean();
    let queryFilter = { refNumber: ref };
    
    if (!prior) {
      // Try with MongoDB _id
      try {
        prior = await Appointment.findById(ref).lean();
        queryFilter = { _id: ref };
      } catch (e) {
        // Invalid ObjectId
      }
    }
    
    console.log('Prior appointment state:', prior);

    // PRE-CHECK: Prevent approving/rescheduling into an already-booked slot
    try {
      const targetStatus = (update.status || (prior && prior.status) || '').toString();
      const targetStatusLower = targetStatus.toLowerCase();
      const targetDate = update.date || (prior && prior.date) || null;
      const targetTime = update.time || (prior && prior.time) || null;
      const willBeApproved = ['approved', 'rescheduled/approved', 'booked'].includes(targetStatusLower);

      if (willBeApproved && targetDate && targetTime) {
        const conflict = await Appointment.findOne({
          date: targetDate,
          time: targetTime,
          status: { $in: ['Approved', 'rescheduled/approved', 'Booked'] },
          $or: [ { refNumber: { $ne: ref } }, { _id: { $ne: prior && prior._id } } ]
        }).lean();
        if (conflict) {
          console.warn('Conflict detected when approving/rescheduling:', { conflictRef: conflict.refNumber, targetDate, targetTime });
          return res.status(409).json({ error: 'Time slot already booked', existingRef: conflict.refNumber });
        }
      }
    } catch (e) {
      console.warn('Pre-check for appointment conflict failed:', e);
    }
    
    const appt = await Appointment.findOneAndUpdate(queryFilter, { $set: update }, { new: true }).lean();
    if(!appt) return res.status(404).json({ error: 'not found' });
    
    console.log('Updated appointment:', appt);

    try{
      const priorStatus = (prior && prior.status || '').toLowerCase();
      const newStatus = (appt.status || '').toLowerCase();
      const wasApproved = ['approved', 'rescheduled/approved', 'booked'].includes(priorStatus);
      const isApproved = ['approved', 'rescheduled/approved', 'booked'].includes(newStatus);

      console.log('Status check:', { priorStatus, newStatus, wasApproved, isApproved });

      // If prior was approved but now unapproved, remove the old approved schedule
      if(wasApproved && !isApproved && prior && prior.date && prior.time){
        await ApprovedSchedule.deleteOne({ date: prior.date, time: prior.time });
      }

      // Track schedule changes
      const hasScheduleChanged = prior && (prior.date !== appt.date || prior.time !== appt.time);
      console.log('Schedule change check:', { 
        hasChanged: hasScheduleChanged,
        oldDate: prior?.date,
        newDate: appt.date,
        oldTime: prior?.time,
        newTime: appt.time
      });

      // If new state is approved, upsert into ApprovedSchedule
      if((isApproved || body.status === 'Booked') && appt.date && appt.time){
        // If the date/time changed from a prior approved entry, remove old one
        if(wasApproved && hasScheduleChanged){
          await ApprovedSchedule.deleteOne({ date: prior.date, time: prior.time });
        }
        
        await ApprovedSchedule.updateOne(
          { date: appt.date, time: appt.time },
          { $set: { date: appt.date, time: appt.time } },
          { upsert: true }
        );
        
        // Determine email type and send notification
        let emailType = 'approved';
        if(hasScheduleChanged && wasApproved) {
          emailType = 'rescheduled';
          console.log('Detected rescheduling:', {
            from: `${prior.date} ${prior.time}`,
            to: `${appt.date} ${appt.time}`
          });
        }
        
        console.log('Sending email notification:', { 
          type: emailType, 
          ref: appt.refNumber,
          email: appt.email 
        });
        
        // Send appropriate email without waiting
        sendAppointmentEmail(appt, emailType).catch(err => {
          console.error('Failed to send appointment email:', err);
          console.error('Appointment details:', {
            ref: appt.refNumber,
            email: appt.email,
            status: newStatus,
            emailType,
            originalDate: prior?.date,
            originalTime: prior?.time,
            newDate: appt.date,
            newTime: appt.time
          });
        });
      }

      // If appointment was just marked completed, send completion email
      if (newStatus === 'completed' && priorStatus !== 'completed') {
        console.log('Detected completion for', appt.refNumber, '— sending completion email');
        sendAppointmentEmail(appt, 'completed').catch(err => {
          console.error('Failed to send completion email:', err);
        });
      }
    }catch(e){ console.error('Failed to sync ApprovedSchedule on update:', e); }

    // broadcast update
    sendSseEvent('appointment:update', appt);
    // record activity log(s) for appointment management (approve, reschedule, complete, assign counselor)
    (async () => {
      try {
            // Determine actor: prefer admin cookie, then counselor cookie, fallback to provided actor or student id
            const cookie = req.headers.cookie || '';
            const parts = cookie.split(';').map(s => s.trim()).filter(Boolean);
            const isAdmin = parts.includes('admin_auth=1') || parts.some(p => p.startsWith('admin_auth='));
            const isCounselor = parts.includes('counselor_auth=1') || parts.some(p => p.startsWith('counselor_auth='));
            let actor = null;
            if (isAdmin) {
              const adminUserPart = parts.find(p => p.startsWith('admin_user='));
              actor = adminUserPart ? decodeURIComponent(adminUserPart.split('=')[1]) : (DEFAULT_COUNSELOR.username || 'admin');
            } else if (isCounselor) {
              const cUserPart = parts.find(p => p.startsWith('counselor_user='));
              actor = cUserPart ? decodeURIComponent(cUserPart.split('=')[1]) : (body.actor || appt.studentid || appt.email || 'counselor');
            } else {
              actor = body.actor || appt.studentid || appt.email || 'system';
            }

        const priorStatus = (prior && prior.status || '').toLowerCase();
        const newStatus = (appt.status || '').toLowerCase();

        // Log schedule changes (reschedule)
        if (prior && (prior.date !== appt.date || prior.time !== appt.time)) {
          await ActivityLog.create({ actor, action: 'reschedule-appointment', details: `Rescheduled ${appt.refNumber} from ${prior.date} ${prior.time} to ${appt.date} ${appt.time}`, ip: req.ip });
        }

        // Log status transitions
        if (priorStatus !== newStatus) {
          if (newStatus.includes('approved') || newStatus === 'booked') {
            await ActivityLog.create({ actor, action: 'approve-appointment', details: `Approved appointment ${appt.refNumber}`, ip: req.ip });
          } else if (newStatus === 'rescheduled') {
            await ActivityLog.create({ actor, action: 'reschedule-appointment', details: `Rescheduled appointment ${appt.refNumber}`, ip: req.ip });
          } else if (newStatus === 'completed') {
            await ActivityLog.create({ actor, action: 'complete-appointment', details: `Marked appointment ${appt.refNumber} as completed`, ip: req.ip });
          } else if (newStatus === 'cancelled' || newStatus === 'cancel') {
            await ActivityLog.create({ actor, action: 'cancel-appointment', details: `Cancelled appointment ${appt.refNumber}`, ip: req.ip });
          } else {
            await ActivityLog.create({ actor, action: 'update-appointment-status', details: `Updated status for ${appt.refNumber} to ${appt.status}`, ip: req.ip });
          }
        }

        // Log counselor assignment
        if (body.counselor && prior && prior.counselor !== body.counselor) {
          await ActivityLog.create({ actor, action: 'assign-counselor', details: `Assigned counselor ${body.counselor} to ${appt.refNumber}`, ip: req.ip });
        }

        // Emit a summary SSE event so admin UI can show activity in realtime
        try {
          const latest = await ActivityLog.find().sort({ createdAt: -1 }).limit(1).lean();
          if (latest && latest[0]) sendSseEvent('activity', latest[0]);
        } catch (e) { /* ignore SSE emission errors */ }
      } catch (e) {
        console.warn('Failed to record appointment activity logs', e);
      }
    })();
    // Broadcast to real-time WebSocket clients
    broadcastUpdate('appointment-updated', {
      refNumber: appt.refNumber,
      status: appt.status,
      date: appt.date,
      time: appt.time,
      counselor: appt.counselor,
      fname: appt.fname,
      lname: appt.lname
    });
    res.json({ ok: true, appointment: appt });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'failed to update' });
  }
});

// Optional: list appointments (admin)
app.get('/api/appointments', async (req, res) => {
  try{
    // Determine caller role using cookie parsing consistent with /api/me
    const cookieHeader = req.headers.cookie || '';
    const parts = cookieHeader.split(';').map(s => s.trim()).filter(Boolean);
    const isAdmin = parts.includes('admin_auth=1') || parts.some(p => p.startsWith('admin_auth='));
    const isCounselor = parts.includes('counselor_auth=1') || parts.some(p => p.startsWith('counselor_auth='));

    let q = {};
    if (isAdmin) {
      // Admin: return all appointments, optionally filter by ?counselor=username
      if (req.query && req.query.counselor) q.counselor = req.query.counselor;
    } else if (isCounselor) {
      // Counselor: restrict to their username from cookie counselor_user
      const cUserPart = parts.find(p => p.startsWith('counselor_user='));
      const counselorUsername = cUserPart ? decodeURIComponent(cUserPart.split('=')[1]) : null;
      if (counselorUsername) q.counselor = counselorUsername;
      else return res.status(401).json({ error: 'unauthenticated' });
    } else {
      // Not authenticated
      return res.status(401).json({ error: 'unauthenticated' });
    }

    const docs = await Appointment.find(q).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ appointments: docs });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// Count today's appointments for a student (for daily limit check)
app.get('/api/appointments/count-today/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Count appointments created today for THIS student
    const studentCount = await Appointment.countDocuments({
      studentId: studentId,
      createdAt: { $gte: today, $lt: tomorrow }
    });
    
    // Count TOTAL appointments created today (all students)
    const totalCount = await Appointment.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    
    console.log(`[DAILY LIMIT] Student ${studentId}: ${studentCount} appointments, Total: ${totalCount} appointments today`);
    res.json({ 
      studentCount: studentCount,
      totalCount: totalCount
    });
  } catch (err) {
    console.error('[DAILY LIMIT] Error counting:', err);
    res.status(500).json({ error: 'Failed to count appointments' });
  }
});

// Get all students from database
// Create a new student (admin only)
app.post('/api/students', async (req, res) => {
  try {
    // simple admin cookie check
    const cookie = req.headers.cookie || '';
    const parts = cookie.split(';').map(s => s.trim()).filter(Boolean);
    const isAdmin = parts.includes('admin_auth=1') || parts.some(p => p.startsWith('admin_auth='));
    if (!isAdmin) return res.status(401).json({ error: 'unauthorized' });

    const {
      schoolId, firstName, middleName, lastName, suffix,
      email, course, year, contact, password
    } = req.body || {};

    if (!schoolId || !firstName || !lastName || !email) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const existing = await Student.findOne({ $or: [{ schoolId }, { email }] }).lean();
    if (existing) return res.status(409).json({ error: 'student exists' });

    const pwd = (password && String(password).trim().length)
      ? password
      : (lastName && String(lastName).trim().length ? String(lastName).trim().toUpperCase() : (String(schoolId || '').trim() || 'CHANGEME'));
    const s = new Student({ schoolId, firstName, middleName, lastName, suffix, email, course, year, contact, password: pwd });
    await s.save();
    return res.json({ ok: true, student: { schoolId: s.schoolId, firstName: s.firstName, lastName: s.lastName, email: s.email, course: s.course, year: s.year, contact: s.contact, _id: s._id } });
  } catch (err) {
    console.error('/api/students POST error', err);
    if (err && err.code === 11000) return res.status(409).json({ error: 'duplicate' });
    res.status(500).json({ error: 'internal' });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ firstName: 1, lastName: 1 }).select('schoolId firstName lastName middleName suffix course year email contact').lean();
    
    // Compute fullName for each student since lean() doesn't include virtuals
    const formattedStudents = students.map(s => ({
      ...s,
      fullName: `${s.firstName} ${s.lastName}`
    }));
    
    res.json({ students: formattedStudents || [] });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Reports aggregation endpoint: monthly counts and urgency breakdown
// Query params:
//  - year (number) default: current year
//  - from, to (yyyy-mm-dd) optional date range
//  - counselor optional
//  - priority optional (urgency filter)
app.get('/api/reports/monthly', async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const from = req.query.from; // yyyy-mm-dd
  const to = req.query.to;
  const counselor = req.query.counselor;
  const priority = req.query.priority; // urgency

  try{
    // Build aggregation pipeline
    const pipeline = [];

    // Parse date string into actual date for grouping
    pipeline.push({
      $addFields: {
        parsedDate: { $dateFromString: { dateString: '$date' } }
      }
    });

    const match = { $and: [] };

    // limit to requested year by parsedDate's year
    match.$and.push({ $expr: { $eq: [{ $year: '$parsedDate' }, year] } });

    if(from){
      match.$and.push({ $expr: { $gte: ['$parsedDate', { $dateFromString: { dateString: from } }] } });
    }
    if(to){
      match.$and.push({ $expr: { $lte: ['$parsedDate', { $dateFromString: { dateString: to } }] } });
    }
    if(counselor && counselor !== 'All Counselors'){
      match.$and.push({ counselor: counselor });
    }
    if(priority && priority !== 'All Priorities'){
      match.$and.push({ urgency: priority });
    }

    if(match.$and.length > 0){ pipeline.push({ $match: match }); }

    // Group by month number
    pipeline.push({
      $group: {
        _id: { $month: '$parsedDate' },
        total: { $sum: 1 },
        crisis: { $sum: { $cond: [{ $eq: ['$urgency', 'Crisis'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$urgency', 'High'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$urgency', 'Medium'] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ['$urgency', 'Low'] }, 1, 0] } }
      }
    });

    // Sort by month
    pipeline.push({ $sort: { '_id': 1 } });

    const results = await Appointment.aggregate(pipeline).allowDiskUse(true);

    // Build months array for all 12 months with zeros where missing
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i, // 0-based
      label: new Date(year, i).toLocaleString('default', { month: 'short' }),
      total: 0,
      urgencies: { Crisis: 0, High: 0, Medium: 0, Low: 0 }
    }));

    results.forEach(r => {
      // r._id is 1-12
      const idx = (r._id || 1) - 1;
      if(idx >= 0 && idx < 12){
        months[idx].total = r.total || 0;
        months[idx].urgencies.Crisis = r.crisis || 0;
        months[idx].urgencies.High = r.high || 0;
        months[idx].urgencies.Medium = r.medium || 0;
        months[idx].urgencies.Low = r.low || 0;
      }
    });

    res.json({ year, months });
  }catch(err){
    console.error('Failed to aggregate monthly reports', err);
    res.status(500).json({ error: 'internal' });
  }
});

// One-time migration endpoint: populate ApprovedSchedule from existing Appointment docs
// Call this after deploying the new ApprovedSchedule feature to sync past approved appointments.
app.post('/api/migrateApprovedSchedules', async (req, res) => {
  try{
    if(mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB not connected' });
    const docs = await Appointment.find({ date: { $exists: true }, time: { $exists: true }, status: { $exists: true } }).lean();
    let count = 0;
    for(const a of docs){
      const st = (a.status || '').toLowerCase();
      if(['approved','rescheduled/approved'].includes(st) && a.date && a.time){
        await ApprovedSchedule.updateOne(
          { date: a.date, time: a.time },
          { $set: { date: a.date, time: a.time } },
          { upsert: true }
        );
        count++;
      }
    }
    res.json({ ok: true, migrated: count });
  }catch(err){
    console.error('Migration failed', err);
    res.status(500).json({ error: 'migration failed' });
  }
});

// Notifications API - list and delete
app.get('/api/notifications', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ notifications: [] });

    // Inspect cookies to decide whether this request comes from a counselor session.
    const cookie = req.headers.cookie || '';
    const parts = cookie.split(';').map(s => s.trim()).filter(Boolean);
    const isAdmin = parts.includes('admin_auth=1') || parts.some(p => p.startsWith('admin_auth='));
    const isCounselor = parts.includes('counselor_auth=1') || parts.some(p => p.startsWith('counselor_auth='));

    // If the session belongs to an admin, return all notifications regardless
    // of any counselor cookie that may also be present.
    if (isAdmin) {
      const docs = await Notification.find().sort({ createdAt: -1 }).limit(200).lean();
      return res.json({ notifications: docs });
    }

    if (isCounselor) {
      // Determine counselor username from cookie and try to lookup their email.
      const userPart = parts.find(p => p.startsWith('counselor_user='));
      const username = userPart ? decodeURIComponent(userPart.split('=')[1]) : null;
      let email = null;
      try {
        if (username) {
          const c = await Counselor.findOne({ username }).lean();
          if (c) email = c.email || null;
        }
      } catch (e) { /* ignore lookup errors and fall back to username-only filter */ }

      // Return notifications related to this counselor only (by actor or email)
      const filter = { $or: [] };
      if (username) filter.$or.push({ actor: username });
      if (email) filter.$or.push({ email: email });
      // If no reliable identifier found, return empty list to avoid leaking admin/system notifications
      if (filter.$or.length === 0) return res.json({ notifications: [] });

      const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      return res.json({ notifications: docs });
    }

    // Non-counselor (admin / system): return all notifications
    const docs = await Notification.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ notifications: docs });
  } catch (err) {
    console.error('Failed to fetch notifications', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete notification', err);
    res.status(500).json({ error: 'failed to delete' });
  }
});

// Mark a notification as read (does not delete)
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Notification.findByIdAndUpdate(id, { $set: { read: true } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    // broadcast update so clients can sync
    try { if (typeof broadcastUpdate === 'function') broadcastUpdate('notification-updated', doc); } catch (e) { /* ignore */ }
    res.json({ ok: true, notification: doc });
  } catch (err) {
    console.error('Failed to mark notification read', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Clear all notifications (administrative)
app.delete('/api/notifications', async (req, res) => {
  try {
    await Notification.deleteMany({});
    // record admin cleared notifications
    try {
      const notif = await Notification.create({ type: 'system', status: 'sent', message: 'Activity logs cleared by admin', email: '' });
      try { sendSseEvent('notification', notif); } catch (e) {}
    } catch (e) { console.warn('Failed to record clear notifications activity', e); }
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to clear notifications', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Activity logs API - list recent activity entries
app.get('/api/activity', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ activities: [] });
    const { actor } = req.query || {};
    const filter = {};
    if (actor) filter.actor = actor;
    const docs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ activities: docs });
  } catch (err) {
    console.error('Failed to fetch activity logs', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Clear activity logs (admin only)
app.delete('/api/activity', async (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s=>s.trim()).includes('admin_auth=1');
    if (!isAdmin) return res.status(401).json({ error: 'not authorized' });
    await ActivityLog.deleteMany({});
    const notif = await Notification.create({ type: 'system', status: 'sent', message: 'Activity logs cleared by admin', email: '' }).catch(()=>null);
    try { if (notif) sendSseEvent('activity', notif); } catch (e) {}
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to clear activity logs', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ----- Counselor leave management APIs -----
// Return all leave dates (summary) and details per counselor
app.get('/api/leaves', async (req, res) => {
  try {
    // Query by username/email to return raw Leave docs for a specific identifier
    // Accept either standalone Leave entries (username/email fields) or
    // Leave documents that reference a Counselor (via counselor ObjectId).
    const { username: qUser, email: qEmail } = req.query || {};
    if (qUser || qEmail) {
      const orClauses = [];
      const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (qUser) {
        // case-insensitive match for username
        orClauses.push({ username: { $regex: new RegExp('^' + escapeRegex(qUser) + '$', 'i') } });
        try {
          const c = await Counselor.findOne({ username: { $regex: new RegExp('^' + escapeRegex(qUser) + '$', 'i') } }).select('_id').lean();
          if (c && c._id) orClauses.push({ counselor: c._id });
        } catch (e) { /* ignore lookup errors */ }
      }
      if (qEmail) {
        orClauses.push({ email: { $regex: new RegExp('^' + escapeRegex(qEmail) + '$', 'i') } });
        try {
          const c2 = await Counselor.findOne({ email: { $regex: new RegExp('^' + escapeRegex(qEmail) + '$', 'i') } }).select('_id').lean();
          if (c2 && c2._id) orClauses.push({ counselor: c2._id });
        } catch (e) { /* ignore lookup errors */ }
      }
      const filter = orClauses.length ? { $or: orClauses } : {};
      console.log('[LEAVES] Query by username/email:', { qUser, qEmail, filter });
      const docs = await Leave.find(filter).lean();
      console.log('[LEAVES] Found leaves count:', docs.length);
      return res.json({ leaves: docs });
    }
    // Load all Leave documents and counselors for name resolution
    const leaves = await Leave.find({}).populate('counselor').lean();
    const counselors = await Counselor.find({}).lean();
    const byId = {};
    const byUsername = {};
    const byEmail = {};
    counselors.forEach(c => {
      byId[String(c._id)] = c;
      if (c.username) byUsername[c.username] = c;
      if (c.email) byEmail[c.email] = c;
    });

    const map = {};

    // Entries from Leaves collection -> store objects { time, name }
    leaves.forEach(l => {
      const d = l.date;
      map[d] = map[d] || [];
      let name = '';
      if (l.counselor) {
        const c = l.counselor;
        name = c.title ? `${c.title} ${c.firstName} ${c.lastName}` : `${c.firstName} ${c.lastName}`;
      } else if (l.username && byUsername[l.username]) {
        const c = byUsername[l.username];
        name = c.title ? `${c.title} ${c.firstName} ${c.lastName}` : `${c.firstName} ${c.lastName}`;
      } else if (l.email && byEmail[l.email]) {
        const c = byEmail[l.email];
        name = c.title ? `${c.title} ${c.firstName} ${c.lastName}` : `${c.firstName} ${c.lastName}`;
      } else {
        name = l.username || l.email || 'Unknown';
      }
      map[d].push({ time: l.time || null, name });
    });

    // Also include any counselor.leaveDates that may not yet be migrated
    const withLeaves = await Counselor.find({ leaveDates: { $exists: true, $ne: [] } }).lean();
    withLeaves.forEach(c => {
      (c.leaveDates || []).forEach(d => {
        map[d] = map[d] || [];
        const name = c.title ? `${c.title} ${c.firstName} ${c.lastName}` : `${c.firstName} ${c.lastName}`;
        // legacy full-day leave entries have time=null
        if (!map[d].some(x => x && x.time === null && x.name === name)) map[d].push({ time: null, name });
      });
    });

    return res.json({ dates: Object.keys(map).sort(), details: map });
  } catch (err) {
    console.error('Error fetching leave dates:', err);
    return res.status(500).json({ error: 'Failed to fetch leave dates' });
  }
});

// Add a leave date for a counselor (body: { date: 'yyyy-mm-dd' })
app.post('/api/counselor/:id/leaves', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });
    const counselor = await Counselor.findById(id);
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });

    // Create a Leave document if it doesn't exist
    const existing = await Leave.findOne({ counselor: counselor._id, date, time: time || null }).lean();
    if (!existing) {
      await Leave.create({ counselor: counselor._id, username: counselor.username || null, email: counselor.email || null, date, time: time || null });
    }

    // Keep backward compatibility: only add to counselor.leaveDates for full-day leaves
    if (!time) {
      counselor.leaveDates = counselor.leaveDates || [];
      if (!counselor.leaveDates.includes(date)) {
        counselor.leaveDates.push(date);
        await counselor.save();
      }
    }

    // notify clients of leave change
    try { sendSseEvent('leave', { action: 'created', counselorId: String(counselor._id), date, time: time || null }); } catch (e) {}
    try { if (typeof broadcastUpdate === 'function') broadcastUpdate('leave-updated', { action: 'created', counselorId: String(counselor._id), date, time: time || null }); } catch (e) {}

    return res.json({ success: true, leaveDates: counselor.leaveDates });
  } catch (err) {
    console.error('Error adding leave date:', err);
    return res.status(500).json({ error: 'Failed to add leave date' });
  }
});

// Get leaves for a specific counselor (by id)
app.get('/api/counselor/:id/leaves', async (req, res) => {
  try {
    const { id } = req.params;
    const counselor = await Counselor.findById(id).lean();
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });
    const leaves = await Leave.find({ counselor: counselor._id }).lean();
    return res.json({ leaves });
  } catch (err) {
    console.error('Error fetching counselor leaves:', err);
    return res.status(500).json({ error: 'Failed to fetch counselor leaves' });
  }
});

// Remove a leave date for a counselor
app.delete('/api/counselor/:id/leaves/:date', async (req, res) => {
  try {
    const { id } = req.params;
    const date = req.params.date;
    const time = req.query.time || null; // optional time (e.g. '9:00 AM' or '09:00')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });
    const counselor = await Counselor.findById(id);
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });

    // Remove from Leaves collection; if time provided, delete only that slot
    const delFilter = { counselor: counselor._id, date };
    if (time) delFilter.time = time;
    await Leave.deleteMany(delFilter);

    // Also remove from counselor.leaveDates for backward compatibility — only remove the date if no more leaves exist for that date
    const remaining = await Leave.findOne({ counselor: counselor._id, date }).lean();
    if (!remaining) {
      counselor.leaveDates = (counselor.leaveDates || []).filter(d => d !== date);
      await counselor.save();
    }

    // notify clients of leave deletion for this counselor
    try { sendSseEvent('leave', { action: 'deleted', counselorId: String(counselor._id), date, time: time || null }); } catch (e) {}
    try { if (typeof broadcastUpdate === 'function') broadcastUpdate('leave-updated', { action: 'deleted', counselorId: String(counselor._id), date, time: time || null }); } catch (e) {}

    return res.json({ success: true, leaveDates: counselor.leaveDates });
  } catch (err) {
    console.error('Error removing leave date:', err);
    return res.status(500).json({ error: 'Failed to remove leave date' });
  }
});

// Generic create leave (does not require an existing Counselor record).
// Body: { counselorId?, username?, email?, date }
app.post('/api/leaves', async (req, res) => {
  try {
    const { counselorId, username, email, date, time } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });

    let counselor = null;
    if (counselorId) counselor = await Counselor.findById(counselorId).exec();

    // if counselor exists, ensure Leave is linked and counselor.leaveDates kept in sync
    if (counselor) {
      const existing = await Leave.findOne({ counselor: counselor._id, date, time: time || null }).lean();
      if (!existing) await Leave.create({ counselor: counselor._id, username: counselor.username || null, email: counselor.email || null, date, time: time || null });
      // Only add to legacy counselor.leaveDates if this is a full-day leave
      if (!time) {
        counselor.leaveDates = counselor.leaveDates || [];
        if (!counselor.leaveDates.includes(date)) {
          counselor.leaveDates.push(date);
          await counselor.save();
        }
      }
      return res.json({ success: true, leaveDates: counselor.leaveDates });
    }

    // otherwise create a standalone Leave record with supplied username/email
    const exists = await Leave.findOne({ username: username || null, email: email || null, date, time: time || null }).lean();
    if (!exists) {
      await Leave.create({ counselor: null, username: username || null, email: email || null, date, time: time || null });
    }
    // notify clients about new standalone leave
    try { sendSseEvent('leave', { action: 'created', counselorId: null, username: username || null, email: email || null, date, time: time || null }); } catch (e) {}
    try { if (typeof broadcastUpdate === 'function') broadcastUpdate('leave-updated', { action: 'created', counselorId: null, username: username || null, email: email || null, date, time: time || null }); } catch (e) {}
    return res.json({ success: true });
  } catch (err) {
    console.error('Error creating leave (generic):', err);
    return res.status(500).json({ error: 'Failed to create leave' });
  }
});

// Generic delete leave. Body: { counselorId?, username?, email?, date }
app.delete('/api/leaves', async (req, res) => {
  try {
    const { counselorId, username, email, date, time } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });

    if (counselorId) {
      const counselor = await Counselor.findById(counselorId).exec();
      if (!counselor) return res.status(404).json({ error: 'Counselor not found' });
      const delFilter = { counselor: counselor._id, date };
      if (time) delFilter.time = time;
      await Leave.deleteMany(delFilter);
      const remaining = await Leave.findOne({ counselor: counselor._id, date }).lean();
      if (!remaining) counselor.leaveDates = (counselor.leaveDates || []).filter(d => d !== date);
      await counselor.save();
      return res.json({ success: true, leaveDates: counselor.leaveDates });
    }

    // delete by username/email fallback
    // Build the filter only with provided identifier fields so we don't
    // accidentally require `email: null` when the record has an email value.
    const delFilter = { date };
    if (username) delFilter.username = username;
    if (email) delFilter.email = email;
    if (time) delFilter.time = time;
    const delRes = await Leave.deleteMany(delFilter);
    // notify clients about generic delete
    try { sendSseEvent('leave', { action: 'deleted', username: username || null, email: email || null, date, time: time || null, deletedCount: delRes.deletedCount || 0 }); } catch (e) {}
    try { if (typeof broadcastUpdate === 'function') broadcastUpdate('leave-updated', { action: 'deleted', username: username || null, email: email || null, date, time: time || null, deletedCount: delRes.deletedCount || 0 }); } catch (e) {}

    // If a counselor document exists for this username/email, ensure legacy
    // `counselor.leaveDates` is kept in sync: remove the date if there
    // are no remaining Leave documents for that counselor/date.
    try {
      // Find any counselor whose username/email matches either provided value
      // This covers cases where the caller passed a username but the DB
      // record uses a different username (eg. temp.counselor) but has the
      // same email, or vice-versa.
      const q = { $or: [] };
      if (username) q.$or.push({ username });
      if (email) q.$or.push({ email });
      // also try cross-matching in case the UI passed email in `username`
      if (username) q.$or.push({ email: username });
      if (email) q.$or.push({ username: email });

      if (q.$or.length > 0) {
        const counselors = await Counselor.find(q).exec();
        for (const counselor of counselors) {
          const remaining = await Leave.findOne({ counselor: counselor._id, date }).lean();
          if (!remaining) {
            counselor.leaveDates = (counselor.leaveDates || []).filter(d => d !== date);
            await counselor.save();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to sync counselor.leaveDates after generic delete', e);
    }

    return res.json({ success: true, deletedCount: delRes.deletedCount || 0 });
  } catch (err) {
    console.error('Error deleting leave (generic):', err);
    return res.status(500).json({ error: 'Failed to delete leave' });
  }
});

// Return or create the default/current counselor record used by admin UI
app.get('/api/counselor/current', async (req, res) => {
  try {
    // Return the counselor record if it exists. Do NOT create a counselor entry
    // for the admin account. Admins are stored in the `admins` collection.
    const counselor = await Counselor.findOne({ username: DEFAULT_COUNSELOR.username });
    if (counselor) return res.json({ counselor });

    // If there's no counselor record for the default username, do NOT
    // create or upsert a Counselor document for the admin account. Admins
    // are authoritative in the `admins` collection and should not be
    // duplicated into `counselors`.
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    if (isAdmin) {
      // Return a non-persistent preview object instead of persisting
      // a counselor document for the admin.
      const preview = {
        title: DEFAULT_COUNSELOR.title || 'Ms.',
        firstName: adminFirstName || DEFAULT_COUNSELOR.name.split(' ')[0] || 'Kristine',
        middleName: adminMiddleName || '',
        lastName: adminLastName || DEFAULT_COUNSELOR.name.split(' ').slice(-1)[0] || 'Lopez',
        email: adminEmail || DEFAULT_COUNSELOR.email || `${adminUsername || DEFAULT_COUNSELOR.username}@example.com`,
        username: adminUsername || DEFAULT_COUNSELOR.username
      };
      return res.json({ counselor: preview, persisted: false });
    }

    // If not admin or creation failed, return a non-persistent preview object
    const preview = {
      title: 'Ms.',
      firstName: 'Kristine',
      middleName: 'Carl B.',
      lastName: 'Lopez',
      email: 'kristine.carl@example.com',
      username: DEFAULT_COUNSELOR.username
    };
    return res.json({ counselor: preview, persisted: false });
  } catch (err) {
    console.error('Error fetching/creating counselor:', err);
    return res.status(500).json({ error: 'Failed to get counselor' });
  }
});

// Update current counselor profile
app.post('/api/counselor/current', async (req, res) => {
  try {
    const body = req.body || {};
    const counselor = await Counselor.findOne({ username: DEFAULT_COUNSELOR.username });
    if (!counselor) {
      // Do not create or update a counselor record for the admin account.
      return res.status(403).json({ error: 'Admin profile is managed via /api/admin. Counselor record not found.' });
    }
    ['title','firstName','middleName','lastName','email'].forEach(k => { if (body[k] !== undefined) counselor[k] = body[k]; });
    await counselor.save();
    // record activity: counselor updated own profile
    (async () => {
      try {
        const actor = DEFAULT_COUNSELOR.username || 'counselor';
        const log = await ActivityLog.create({ actor, action: 'update-counselor-profile', details: `Updated counselor profile ${actor}`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record update-counselor-profile activity', e); }
    })();
    return res.json({ counselor });
  } catch (err) {
    console.error('Error updating counselor:', err);
    return res.status(500).json({ error: 'Failed to update counselor' });
  }
});

// Create a peer referral (student submits)
app.post('/api/referrals', async (req, res) => {
  try {
    const body = req.body || {};
    const required = ['referrerName','referrerStudentId','referrerEmail','relationship','studentName','studentId','concernTypes','description'];
    for(const k of required){ if(!body[k]) return res.status(400).json({ error: `${k} is required` }); }

    if(String(body.description).length > 500) return res.status(400).json({ error: 'description must be <= 500 chars' });

    // Generate simple refId
    const refId = 'PR' + Date.now().toString(36).toUpperCase().slice(-8);

    const doc = new Referral({
      refId,
      referrerName: body.referrerName,
      referrerStudentId: body.referrerStudentId,
      referrerEmail: body.referrerEmail,
      relationship: body.relationship,
      studentName: body.studentName,
      studentId: body.studentId,
      studentCourseYearSection: body.studentCourseYearSection || '',
      studentAware: body.studentAware || 'Not Sure',
      concernTypes: Array.isArray(body.concernTypes) ? body.concernTypes : (body.concernTypes ? [body.concernTypes] : []),
      description: body.description,
      urgency: body.urgency === 'Urgent' ? 'Urgent' : 'Normal',
      submittedByStudentId: body.referrerStudentId
    });

    await doc.save();
    // Broadcast simple SSE event if desired
    try { sendSseEvent('referral', doc); } catch(e){}
    // record activity: student created referral
    (async () => {
      try {
        const actor = doc.referrerStudentId || doc.referrerEmail || 'student';
        const log = await ActivityLog.create({ actor, action: 'create-referral', details: `Created referral ${doc.refId} for ${doc.studentName}`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record create-referral activity', e); }
    })();

    res.json({ ok: true, referral: doc });
  } catch (err) {
    console.error('Failed to create referral', err);
    res.status(500).json({ error: 'internal' });
  }
});

// List referrals - if ?studentId= then return only those submitted by student
app.get('/api/referrals', async (req, res) => {
  try {
    const { studentId } = req.query || {};
    const q = {};
    if (studentId) q.submittedByStudentId = studentId;
    const items = await Referral.find(q).sort({ createdAt: -1 }).lean();
    res.json({ referrals: items });
  } catch (err) {
    console.error('Failed to list referrals', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Get referral details
app.get('/api/referrals/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const item = await Referral.findOne({ refId: id });
    if(!item) return res.status(404).json({ error: 'not found' });
    res.json({ referral: item });
  } catch (err) {
    console.error('Failed to get referral', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Update referral (counselor actions: add notes, update status)
app.put('/api/referrals/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const item = await Referral.findOne({ refId: id });
    if(!item) return res.status(404).json({ error: 'not found' });

    if(body.counselorNotes !== undefined) item.counselorNotes = body.counselorNotes;
    if(body.status !== undefined && ['Pending','Reviewed','Action Taken','Cancelled'].includes(body.status)) item.status = body.status;

    await item.save();
    // record activity: counselor updated referral
    (async () => {
      try {
        const actor = DEFAULT_COUNSELOR.username || 'counselor';
        const log = await ActivityLog.create({ actor, action: 'update-referral', details: `Updated referral ${item.refId} status=${item.status}`, ip: req.ip });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record update-referral activity', e); }
    })();

    res.json({ ok: true, referral: item });
  } catch (err) {
    console.error('Failed to update referral', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Activity Logs API removed: feature disabled. Activity recording still occurs server-side but
// the HTTP endpoints to list/clear activity logs have been disabled.