require('dotenv').config();
const mongoose = require('mongoose');
const Counselor = require('../models/counselors');
const Leave = require('../models/leaves');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

async function backupLeaves() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Find counselors that have non-empty leaveDates
    const counselors = await Counselor.find({ leaveDates: { $exists: true, $ne: [] } }).lean();
    if (!counselors || counselors.length === 0) {
      console.log('No counselors with leaveDates found. Nothing to migrate.');
      return process.exit(0);
    }

    let migratedCount = 0;
    for (const c of counselors) {
      const counselorId = c._id;
      const username = c.username || null;
      const email = c.email || null;
      const dates = Array.isArray(c.leaveDates) ? c.leaveDates : [];

      for (const d of dates) {
        // Skip if a leave document for this counselor+date already exists
        const exists = await Leave.findOne({ $or: [{ counselor: counselorId }, { username }, { email }], date: d }).lean();
        if (exists) continue;

        await Leave.create({ counselor: counselorId, username, email, date: d });
        migratedCount++;
      }
    }

    console.log(`Migration complete. Migrated ${migratedCount} leave entries from ${counselors.length} counselor(s).`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    try { await mongoose.disconnect(); } catch(e){}
    process.exit(1);
  }
}

backupLeaves();
