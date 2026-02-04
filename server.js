require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const Counselor = require('./models/counselors');
const Student = require('./models/students');
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
        <li>Counselor: ${appt.counselor || 'To be assigned'}</li>
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
          type: type === 'rescheduled' ? 'rescheduled' : 'approved',
          refNumber: appt.refNumber,
          email: to,
          status: 'sent',
          message: `Email confirmation for ${studentName}'s appointment on ${formatDateForEmail(appt.date)} at ${formatTimeForEmail(appt.time)} was successfully sent.`
        });
        // broadcast notification over SSE so admin UI can update in realtime
        try { sendSseEvent('notification', notif); } catch (e) { /* ignore SSE errors */ }
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
          type: type === 'rescheduled' ? 'rescheduled' : 'approved',
          refNumber: appt.refNumber,
          email: appt.email,
          status: 'failed',
          message: `Failed to send email confirmation for ${studentName}'s appointment on ${formatDateForEmail(appt.date)} at ${formatTimeForEmail(appt.time)}. Error: ${err.message || 'Unknown error'}`
        });
        try { sendSseEvent('notification', notif); } catch (e) { /* ignore SSE errors */ }
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
  type: { type: String, enum: ['approved','rescheduled','system','other'], default: 'other' },
  refNumber: String,
  email: String,
  status: { type: String, enum: ['sent','failed'], required: true },
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

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
  const { studentId, email } = req.body;

  if (!studentId || !email) {
    return res.status(400).json({ error: 'Student ID and email are required' });
  }

  try {
    const appointments = await Appointment.find({
      studentid: studentId,
      email: email
    }).sort({ createdAt: -1 });

    res.json(appointments);
  } catch (error) {
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

// Simple admin auth (development-only)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).json({ error: 'missing credentials' });
  if(username.trim().toLowerCase() === DEFAULT_COUNSELOR.username && password === adminPassword){
    // set a simple cookie to mark the session (HttpOnly)
    res.setHeader('Set-Cookie', 'admin_auth=1; Path=/; HttpOnly');
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

    return res.json({
      ok: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
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

    return res.json({
      ok: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Check admin authentication
app.get('/api/admin/check', (req, res) => {
  const cookie = req.headers.cookie || '';
  const isAdmin = cookie.split(';').map(s => s.trim()).includes('admin_auth=1');
  if (!isAdmin) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  return res.json({ ok: true });
});

// Counselor API endpoints
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

app.post('/api/admin/logout', (req, res) => {
  // clear cookie
  res.setHeader('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; Max-Age=0');
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

    // Duplication check: prevent double-booking same date+time
    if(formattedData.date && formattedData.time){
      const existing = await Appointment.findOne({ 
        date: formattedData.date, 
        time: formattedData.time, 
        status: 'booked' 
      }).lean();
      if(existing){
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
    }catch(e){ console.error('Failed to sync ApprovedSchedule on update:', e); }

    // broadcast update
    sendSseEvent('appointment:update', appt);
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
    const students = await Student.find().sort({ fullName: 1 }).select('schoolId fullName course email').lean();
    res.json({ students: students || [] });
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