require('dotenv').config();
const mongoose = require('mongoose');
const Counselor = require('../models/counselors');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

async function archiveTempCounselor() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Find counselor with username temp.counselor (case-insensitive)
    const c = await Counselor.findOne({ username: { $regex: /^temp\.counselor$/i } });
    if (!c) {
      console.log('No temp.counselor record found. Nothing to do.');
      await mongoose.disconnect();
      return process.exit(0);
    }

    console.log('Found temp counselor:', c._id, c.username, c.email);
    // Archive rather than delete: set status and add archived flag
    c.status = 'Archived';
    c.archived = true;
    // Optionally alter username to avoid future collisions
    c.username = `archived_${c.username}_${Date.now()}`;
    await c.save();

    console.log('Archived temp counselor. New username:', c.username);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('archive-temp-counselor failed', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

archiveTempCounselor();
