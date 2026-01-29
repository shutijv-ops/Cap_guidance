const mongoose = require('mongoose');
const Student = require('./models/students');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/jrmsu_appointments')
  .then(async () => {
    try {
      const student = await Student.findOne({schoolId: '25-A-01465'});
      if (student) {
        console.log('Found student:', student.firstName);
        console.log('Password in DB:', student.password.substring(0, 20) + '...');
        
        // Test password comparison
        const isValid = await student.comparePassword('Sotillo');
        console.log('Password matches (Sotillo):', isValid);
        
        const testHash = await bcrypt.hash('Sotillo', 10);
        console.log('Test hash of Sotillo:', testHash);
      }
      process.exit(0);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Connection error:', err.message);
    process.exit(1);
  });
