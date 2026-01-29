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
        email: 'sotillo09@gmail.com',
        password: 'Sotillo'
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
        email: 'juan.delacruz@jrmsu.edu.ph',
        password: 'Dela Cruz'
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
        email: 'maria.santos@jrmsu.edu.ph',
        password: 'Santos'
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
        email: 'jose.reyes@jrmsu.edu.ph',
        password: 'Reyes'
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
        email: 'anna.garcia@jrmsu.edu.ph',
        password: 'Garcia'
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
        email: 'miguel.lopez@jrmsu.edu.ph',
        password: 'Lopez'
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
        email: 'sofia.torres@jrmsu.edu.ph',
        password: 'Torres'
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
        email: 'carlos.morales@jrmsu.edu.ph',
        password: 'Morales'
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
        email: 'isabel.cruz@jrmsu.edu.ph',
        password: 'Cruz'
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
        email: 'roberto.fernandez@jrmsu.edu.ph',
        password: 'Fernandez'
      }
    ];

    // Create students with .save() to trigger pre-save hooks for password hashing
    const createdStudents = [];
    for (const studentData of sampleStudentsData) {
      const student = new Student(studentData);
      await student.save();
      createdStudents.push(student);
    }

    console.log(`✅ Successfully created ${createdStudents.length} sample students:\n`);
    createdStudents.forEach((student, index) => {
      console.log(`${index + 1}. ${student.schoolId} - ${student.firstName} ${student.lastName}`);
      console.log(`   Email: ${student.email}`);
      console.log(`   Course: ${student.course}`);
      console.log(`   Year: ${student.year}\n`);
    });

    console.log('📝 LOGIN CREDENTIALS:');
    console.log('─'.repeat(50));
    console.log('School ID: 25-A-01465');
    console.log('Password: Sotillo');
    console.log('─'.repeat(50));
    console.log('\nOr use any of the student credentials above.');
    console.log('Password = Last Name (or Last Name with suffix if applicable)');
    console.log('\n⚠️  On first login, students will be prompted to change their password.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

clearAndSeed();
