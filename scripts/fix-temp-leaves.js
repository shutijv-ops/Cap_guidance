require('dotenv').config();
const mongoose = require('mongoose');
const Counselor = require('../models/counselors');
const Admin = require('../models/admins');
const Leave = require('../models/leaves');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

async function fixTempLeaves() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Prefer persisted Admin document
    let adminUsername = 'kristine.carl';
    let adminEmail = 'kristine.carl@example.com';
    try {
      const adminDoc = await Admin.findOne({}).lean();
      if (adminDoc) {
        adminUsername = adminDoc.username || adminUsername;
        adminEmail = adminDoc.email || adminEmail;
      }
    } catch (e) {
      console.warn('Could not load Admin doc, using defaults', e);
    }

    // Find any counselor doc created for temp.counselor
    const tempCounselor = await Counselor.findOne({ username: { $regex: /^temp\.counselor$/i } }).lean();

    const orClauses = [ { username: { $regex: /^temp\.counselor$/i } }, { email: { $regex: /^temp\.counselor(@|\.)/i } } ];
    if (tempCounselor && tempCounselor._id) orClauses.push({ counselor: tempCounselor._id });

    const filter = { $or: orClauses };
    const leaves = await Leave.find(filter).lean();

    console.log(`Found ${leaves.length} leave(s) referencing temp.counselor`);
    if (leaves.length === 0) {
      console.log('No leaves to migrate. Exiting.');
      await mongoose.disconnect();
      return process.exit(0);
    }

    let updated = 0;
    for (const l of leaves) {
      const update = {};
      // clear counselor object reference and set username/email to admin
      update.counselor = null;
      update.username = adminUsername;
      update.email = adminEmail;
      try {
        await Leave.updateOne({ _id: l._id }, { $set: update });
        updated++;
        console.log(`Updated leave ${l._id} -> username=${adminUsername}`);
      } catch (e) {
        console.error('Failed to update leave', l._id, e);
      }
    }

    console.log(`Migration complete. Updated ${updated}/${leaves.length} leave(s).`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('fix-temp-leaves failed', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

fixTempLeaves();
