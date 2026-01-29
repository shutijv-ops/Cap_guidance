const mongoose = require('mongoose');
const Student = require('./models/students');

mongoose.connect('mongodb://127.0.0.1:27017/jrmsu_appointments')
  .then(async () => {
    try {
      const count = await Student.countDocuments();
      console.log('Total students in DB:', count);
      
      const student = await Student.findOne({schoolId: '25-A-01465'});
      if (student) {
        console.log('Found student:', student.firstName, student.lastName);
        console.log('SchoolId:', student.schoolId);
      } else {
        console.log('Student not found');
        const allStudents = await Student.find().limit(3);
        console.log('First 3 students:', allStudents.map(s => ({id: s.schoolId, name: s.firstName})));
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
