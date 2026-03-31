require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/students');

const sampleStudents = [
  {
    schoolId: '25-A-01465',
    firstName: 'Melrose',
    middleName: 'C.',
    lastName: 'Sotillo',
    sex: 'Female',
    suffix: '',
    course: 'BS in Hotel and Restaurant Management',
    year: '1st Year',
    contact: '09307667382',
    email: 'sotillo09@gmail.com',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01466',
    firstName: 'Juan',
    middleName: 'M.',
    lastName: 'Dela Cruz',
    sex: 'Male',
    suffix: '',
    course: 'BS in Civil Engineering',
    year: '2nd Year',
    contact: '09123456789',
    email: 'juan.delacruz@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01467',
    firstName: 'Maria',
    middleName: 'G.',
    lastName: 'Santos',
    sex: 'Female',
    suffix: '',
    course: 'BS in Nursing',
    year: '3rd Year',
    contact: '09234567890',
    email: 'maria.santos@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01468',
    firstName: 'Jose',
    middleName: 'R.',
    lastName: 'Reyes',
    sex: 'Male',
    suffix: 'Jr.',
    course: 'BS in Computer Engineering',
    year: '4th Year',
    contact: '09345678901',
    email: 'jose.reyes@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01469',
    firstName: 'Anna',
    middleName: 'L.',
    lastName: 'Garcia',
    sex: 'Female',
    suffix: '',
    course: 'Bachelor of Science in Education - English',
    year: '2nd Year',
    contact: '09456789012',
    email: 'anna.garcia@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01470',
    firstName: 'Miguel',
    middleName: 'P.',
    lastName: 'Lopez',
    sex: 'Male',
    suffix: '',
    course: 'BS in Accounting Information System',
    year: '1st Year',
    contact: '09567890123',
    email: 'miguel.lopez@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01471',
    firstName: 'Sofia',
    middleName: 'T.',
    lastName: 'Torres',
    sex: 'Female',
    suffix: '',
    course: 'BS in Business Administration - Marketing Management',
    year: '3rd Year',
    contact: '09678901234',
    email: 'sofia.torres@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01472',
    firstName: 'Carlos',
    middleName: 'V.',
    lastName: 'Morales',
    sex: 'Male',
    suffix: '',
    course: 'BS in Electrical Engineering',
    year: '4th Year',
    contact: '09789012345',
    email: 'carlos.morales@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01473',
    firstName: 'Isabel',
    middleName: 'R.',
    lastName: 'Cruz',
    sex: 'Female',
    suffix: '',
    course: 'BS in Marine Engineering',
    year: '2nd Year',
    contact: '09890123456',
    email: 'isabel.cruz@jrmsu.edu.ph',
    passwordChanged: false
  },
  {
    schoolId: '25-A-01474',
    firstName: 'Roberto',
    middleName: 'F.',
    lastName: 'Fernandez',
    sex: 'Male',
    suffix: 'Sr.',
    course: 'BS in Tourism Management',
    year: '1st Year',
    contact: '09901234567',
    email: 'roberto.fernandez@jrmsu.edu.ph',
    passwordChanged: false
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments');
    console.log('Connected to MongoDB');

    // Check if students already exist
    const existingCount = await Student.countDocuments();
    if (existingCount > 0) {
      console.log(`Database already has ${existingCount} students. Skipping seeding.`);
      console.log('To reset, delete the collection first.');
      process.exit(0);
    }

    // Create students with default password (lastName in uppercase)
    // Hash passwords before inserting
    const bcrypt = require('bcryptjs');
    const studentsToCreate = await Promise.all(
      sampleStudents.map(async (student) => {
        const defaultPassword = student.lastName.toUpperCase(); // Capitalize last name
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);
        return {
          ...student,
          password: hashedPassword // Default password is hashed uppercase last name
        };
      })
    );

    const created = await Student.insertMany(studentsToCreate);
    console.log(`Successfully created ${created.length} sample students:`);
    created.forEach(student => {
      console.log(`  - ${student.schoolId}: ${student.fullName} (${student.email})`);
    });

    console.log('\nStudents can log in with their School ID; default password is set to the student\'s LAST NAME (uppercase) but is stored hashed.');
    console.log('On first login, they will be prompted to change their password.');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedDatabase();
