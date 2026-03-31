require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/students');
const bcrypt = require('bcryptjs');

async function clearAndSeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments');
    console.log('Connected to MongoDB');

    // Clear existing students
    await Student.deleteMany({});
    console.log('Cleared existing students\n');

    const sampleStudentsData = [
      {
        schoolId: '25-A-01465',
        firstName: 'Melrose',
        middleName: 'C.',
        lastName: 'Sotillo',
        suffix: '',
        course: 'BS in Hotel and Restaurant Management',
        year: '1st Year',
        contact: '09307667382',
        email: 'sotillo09@gmail.com'
      },
      {
        schoolId: '25-A-01466',
        firstName: 'Juan',
        middleName: 'M.',
        lastName: 'Dela Cruz',
        suffix: '',
        course: 'BS in Civil Engineering',
        year: '2nd Year',
        contact: '09123456789',
        email: 'juan.delacruz@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01467',
        firstName: 'Maria',
        middleName: 'G.',
        lastName: 'Santos',
        suffix: '',
        course: 'BS in Nursing',
        year: '3rd Year',
        contact: '09234567890',
        email: 'maria.santos@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01468',
        firstName: 'Jose',
        middleName: 'R.',
        lastName: 'Reyes',
        suffix: 'Jr.',
        course: 'BS in Computer Engineering',
        year: '4th Year',
        contact: '09345678901',
        email: 'jose.reyes@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01469',
        firstName: 'Anna',
        middleName: 'L.',
        lastName: 'Garcia',
        suffix: '',
        course: 'Bachelor of Science in Education - English',
        year: '2nd Year',
        contact: '09456789012',
        email: 'anna.garcia@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01470',
        firstName: 'Miguel',
        middleName: 'P.',
        lastName: 'Lopez',
        suffix: '',
        course: 'BS in Accounting Information System',
        year: '1st Year',
        contact: '09567890123',
        email: 'miguel.lopez@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01471',
        firstName: 'Sofia',
        middleName: 'T.',
        lastName: 'Torres',
        suffix: '',
        course: 'BS in Business Administration - Marketing Management',
        year: '3rd Year',
        contact: '09678901234',
        email: 'sofia.torres@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01472',
        firstName: 'Carlos',
        middleName: 'V.',
        lastName: 'Morales',
        suffix: '',
        course: 'BS in Electrical Engineering',
        year: '4th Year',
        contact: '09789012345',
        email: 'carlos.morales@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01473',
        firstName: 'Isabel',
        middleName: 'R.',
        lastName: 'Cruz',
        suffix: '',
        course: 'BS in Marine Engineering',
        year: '2nd Year',
        contact: '09890123456',
        email: 'isabel.cruz@jrmsu.edu.ph'
      },
      {
        schoolId: '25-A-01474',
        firstName: 'Roberto',
        middleName: 'F.',
        lastName: 'Fernandez',
        suffix: 'Sr.',
        course: 'BS in Tourism Management',
        year: '1st Year',
        contact: '09901234567',
        email: 'roberto.fernandez@jrmsu.edu.ph'
      }
    ];

    // Create students: hash default password (last name) explicitly before saving
    const createdStudents = [];
    for (const studentData of sampleStudentsData) {
      const defaultPassword = (studentData.password || studentData.lastName || '').toString();
      const hashed = await bcrypt.hash(defaultPassword, 10);
      const s = new Student({ ...studentData, password: hashed });
      await s.save();
      createdStudents.push(s);
    }

    console.log(`✅ Successfully created ${createdStudents.length} sample students:\n`);
    createdStudents.forEach((student, index) => {
      console.log(`${index + 1}. ${student.schoolId} - ${student.firstName} ${student.lastName}`);
      console.log(`   Email: ${student.email}`);
      console.log(`   Course: ${student.course}`);
      console.log(`   Year: ${student.year}\n`);
    });

    console.log('📝 LOGIN NOTES:');
    console.log('Default passwords are set to each student\'s LAST NAME (uppercase) and are stored hashed.');
    console.log('Students will be prompted to change their password on first login.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

clearAndSeed();
