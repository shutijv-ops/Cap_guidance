require('dotenv').config();
const mongoose = require('mongoose');
const Referral = require('./models/referrals');

async function seedReferrals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments');
    console.log('Connected to MongoDB');

    const count = await Referral.countDocuments();
    if (count > 0) {
      console.log(`Referrals collection already has ${count} documents. Skipping seed.`);
      process.exit(0);
    }

    const sample = {
      refId: 'PR' + Date.now().toString(36).toUpperCase().slice(-8),
      referrerName: 'Test Student',
      referrerStudentId: 'TS001',
      referrerEmail: 'test@student.edu',
      relationship: 'Classmate',
      studentName: 'Jane Doe',
      studentId: 'S999',
      studentCourseYearSection: 'BS Nursing - 3rd Year',
      studentAware: 'Not Sure',
      concernTypes: ['Mental Health'],
      description: 'This is a seeded test referral. Please ignore in production.',
      urgency: 'Low',
      status: 'Pending',
      counselorNotes: '',
      submittedByStudentId: 'TS001'
    };

    const created = await Referral.create(sample);
    console.log('Inserted sample referral:', created.refId);

  } catch (err) {
    console.error('Failed to seed referrals:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedReferrals();
