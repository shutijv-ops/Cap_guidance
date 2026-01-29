require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Counselor = require('./models/counselors');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

const defaultCounselors = [
  {
    title: 'Ms.',
    firstName: 'Kristine',
    middleName: 'Carl B.',
    lastName: 'Lopez',
    email: 'kristine.carl@jrmsu.edu.ph',
    username: 'kristine.carl',
    password: 'admin123', // Will be hashed
    role: 'Guidance Counselor',
    status: 'Active'
  }
];

async function seedCounselors() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Clear existing counselors (optional, comment out to keep existing)
    // await Counselor.deleteMany({});
    // console.log('Cleared existing counselors');

    // Check if counselor exists
    const existingCounselor = await Counselor.findOne({ username: 'kristine.carl' });
    
    if (existingCounselor) {
      console.log('Counselor "kristine.carl" already exists');
    } else {
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash('admin123', 10);

      const newCounselors = defaultCounselors.map(c => ({
        ...c,
        password: hashedPassword
      }));

      await Counselor.insertMany(newCounselors);
      console.log(`${newCounselors.length} counselor(s) seeded successfully`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding counselors:', error);
    process.exit(1);
  }
}

seedCounselors();
