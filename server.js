const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const Counselor = require('./models/counselors');

// Define Appointment Schema
const appointmentSchema = new mongoose.Schema({
  studentid: String,
  fname: String,
  mname: String,
  lname: String,
  suffix: String,
  course: String,
  year: String,
  contact: String,
  email: String,
  urgency: String,
  reason: String,
  date: String, // stored as yyyy-mm-dd
  time: String,
  refNumber: String,
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Pending' }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

const app = express();
const PORT = process.env.PORT || 3000;

// Use environment variable MONGODB_URI or fallback to local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Default counselor info
const DEFAULT_COUNSELOR = {
  id: 'counselor1',
  name: 'Mrs. Kristine Carl B. Lopez',
  role: 'Guidance Counselor',
  username: 'kristine.carl',
  password: 'admin123' // Note: In production, use hashed passwords
};

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

// SSE clients for realtime updates
const sseClients = new Set();

function sendSseEvent(name, data){
  // build SSE payload without template literals to avoid parser issues
  const payload = 'event: ' + name + '\n' + 'data: ' + JSON.stringify(data) + '\n\n';
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      // ignore individual client errors
    }
  }
}

// Start server first so static files are always available (frontend can fallback if DB is down)
const server = app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT} (http://localhost:${PORT})`);
});

// Simple admin auth (development-only)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).json({ error: 'missing credentials' });
  if(username.trim().toLowerCase() === DEFAULT_COUNSELOR.username && password === DEFAULT_COUNSELOR.password){
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

// Connect to MongoDB (no deprecated options)
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB:', err.message));

// API: get booked slots for a date
app.get('/api/bookedSlots', async (req, res) => {
  const date = req.query.date; // expected yyyy-mm-dd
  if(!date) return res.status(400).json({ error: 'date is required' });
  try{
    // If MongoDB isn't connected, return an empty booked list so the client can fallback to demo data
    if(mongoose.connection.readyState !== 1){
      return res.json({ booked: [] });
    }
    const docs = await Appointment.find({ date, status: 'booked' }).select('time -_id').lean();
    const booked = docs.map(d => d.time).filter(Boolean);
    res.json({ booked });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// SSE stream for admin dashboards to receive realtime appointment events
app.get('/api/appointments/stream', (req, res) => {
  // headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // send a welcome comment
  res.write(': connected\n\n');

  sseClients.add(res);
  req.on('close', () => {
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
    const payload = { ...formattedData, refNumber: ref, createdAt: appt.createdAt, saved: true };
    // broadcast to SSE clients
    sendSseEvent('appointment', payload);
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
    const appt = await Appointment.findOneAndUpdate({ refNumber: ref }, { $set: update }, { new: true }).lean();
    if(!appt) return res.status(404).json({ error: 'not found' });
    // broadcast update
    sendSseEvent('appointment:update', appt);
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