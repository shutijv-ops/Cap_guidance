require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const Counselor = require('./models/counselors');
const Student = require('./models/students');
const Referral = require('./models/referrals');
const Setting = require('./models/settings');
const sgMail = require('@sendgrid/mail');
const socketIO = require('socket.io');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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

    const msg = {
      to,
      from: process.env.FROM_EMAIL,
      subject,
      html
    };

    await sgMail.send(msg);
    console.log('Approval email sent to', to);
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
    console.error('Failed to send approval email:', err?.response?.body?.errors || err);
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
            message: `Failed to send email confirmation for ${studentName}'s appointment on ${formatDateForEmail(appt.date)} at ${formatTimeForEmail(appt.time)}. Error: ${err.message || 'Unknown error'}`
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

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Minimal CORS (allow same-origin or any for demo)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).json({ error: 'missing credentials' });
  if(username.trim().toLowerCase() === DEFAULT_COUNSELOR.username && password === adminPassword){
    // set a simple cookie to mark the session (HttpOnly)
    res.setHeader('Set-Cookie', 'admin_auth=1; Path=/; HttpOnly');
    // Record activity: admin login (ActivityLog)
    (async () => {
      try {
        const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'login', details: `Admin logged in` });
        try { sendSseEvent('activity', log); } catch (e) {}
      } catch (e) { console.warn('Failed to record admin login activity', e); }
    })();
    return res.json({ 
      ok: true, 
      user: { 
        username: DEFAULT_COUNSELOR.username,
        name: DEFAULT_COUNSELOR.name,
        role: DEFAULT_COUNSELOR.role
      } 
    });
  }
  return res.status(401).json({ error: 'invalid credentials' });
});

// Admin change password endpoint
app.post('/api/admin/change-password', (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify admin is authenticated
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    if (!isAdmin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify old password
    if (oldPassword !== adminPassword) {
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
app.post('/api/admin/update-account', (req, res) => {
  try {
    const { oldPassword, newPassword, newUsername } = req.body;

    if (!oldPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    if (!newPassword && !newUsername) {
      return res.status(400).json({ error: 'Please provide new password or username' });
    }

    // Verify admin is authenticated
    const cookie = req.headers.cookie || '';
    const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
    if (!isAdmin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify old password
    if (oldPassword !== adminPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      adminPassword = newPassword;
      console.log('[ADMIN] Password updated');
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
    // Get counselor ID from session/cookie or request body
    // For now, we'll get the first counselor (the logged-in one)
    const counselor = await Counselor.findOne().select('-password');
    
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

    // Update the first counselor (the logged-in one)
    const counselor = await Counselor.findOneAndUpdate(
      {},
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

app.get('/api/admin/check', (req, res) => {
  const cookie = req.headers.cookie || '';
  const isAdmin = cookie.split(';').map(s=>s.trim()).includes('admin_auth=1');
  if(isAdmin) return res.json({ ok: true, user: { username: 'kristine carl' } });
  return res.status(401).json({ ok: false });
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
  // clear cookie
  res.setHeader('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; Max-Age=0');
  // record logout activity
  (async () => {
    try {
      const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'logout', details: 'Admin logged out' });
      try { sendSseEvent('activity', log); } catch (e) {}
    } catch (e) { console.warn('Failed to record admin logout activity', e); }
  })();
  res.json({ ok: true });
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
        // Determine actor: prefer admin cookie, fallback to provided actor or student id
        const cookie = req.headers.cookie || '';
        const isAdmin = cookie.split(';').map(s=>s.trim()).includes('admin_auth=1');
        const actor = isAdmin ? (DEFAULT_COUNSELOR.username || 'admin') : (body.actor || appt.studentid || appt.email || 'system');

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
    const docs = await Appointment.find().sort({ createdAt: -1 }).limit(200).lean();
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
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ firstName: 1, lastName: 1 }).select('schoolId firstName lastName middleName course year email').lean();
    
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

// ----- Counselor leave management APIs -----
// Return all leave dates (summary) and details per counselor
app.get('/api/leaves', async (req, res) => {
  try {
    const withLeaves = await Counselor.find({ leaveDates: { $exists: true, $ne: [] } }).lean();
    const map = {};
    withLeaves.forEach(c => {
      (c.leaveDates || []).forEach(d => {
        map[d] = map[d] || [];
        const name = c.title ? `${c.title} ${c.firstName} ${c.lastName}` : `${c.firstName} ${c.lastName}`;
        map[d].push(name);
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
    const { date } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });
    const counselor = await Counselor.findById(id);
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });
    counselor.leaveDates = counselor.leaveDates || [];
    if (!counselor.leaveDates.includes(date)) counselor.leaveDates.push(date);
    await counselor.save();
    return res.json({ success: true, leaveDates: counselor.leaveDates });
  } catch (err) {
    console.error('Error adding leave date:', err);
    return res.status(500).json({ error: 'Failed to add leave date' });
  }
});

// Remove a leave date for a counselor
app.delete('/api/counselor/:id/leaves/:date', async (req, res) => {
  try {
    const { id } = req.params;
    const date = req.params.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });
    const counselor = await Counselor.findById(id);
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });
    counselor.leaveDates = (counselor.leaveDates || []).filter(d => d !== date);
    await counselor.save();
    return res.json({ success: true, leaveDates: counselor.leaveDates });
  } catch (err) {
    console.error('Error removing leave date:', err);
    return res.status(500).json({ error: 'Failed to remove leave date' });
  }
});

// Return or create the default/current counselor record used by admin UI
app.get('/api/counselor/current', async (req, res) => {
  try {
    let counselor = await Counselor.findOne({ username: DEFAULT_COUNSELOR.username });
    if (!counselor) {
      counselor = new Counselor({
        title: 'Ms.',
        firstName: 'Kristine',
        middleName: 'Carl B.',
        lastName: 'Lopez',
        email: 'kristine.carl@example.com',
        username: DEFAULT_COUNSELOR.username,
        password: DEFAULT_COUNSELOR.password
      });
      await counselor.save();
    }
    return res.json({ counselor });
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
    if (!counselor) return res.status(404).json({ error: 'Counselor not found' });
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

// ===== Activity Logs API =====
// List recent activity logs
app.get('/api/activity-logs', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ logs: [] });
    const docs = await ActivityLog.find().sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ logs: docs });
  } catch (err) {
    console.error('Failed to fetch activity logs', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Delete a single activity log entry
app.delete('/api/activity-logs/:id', async (req, res) => {
  try {
    await ActivityLog.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete activity log', err);
    return res.status(500).json({ error: 'failed to delete' });
  }
});

// Clear all activity logs (administrative)
app.delete('/api/activity-logs', async (req, res) => {
  try {
    await ActivityLog.deleteMany({});
    // Record that an admin cleared logs (store as ActivityLog for audit)
    try {
      const log = await ActivityLog.create({ actor: DEFAULT_COUNSELOR.username, action: 'clear-activity-logs', details: 'Admin cleared all activity logs' });
      try { sendSseEvent('activity', log); } catch (e) {}
    } catch (e) { console.warn('Failed to create clear-activity-logs record', e); }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to clear activity logs', err);
    return res.status(500).json({ error: 'failed' });
  }
});