const mongoose = require('mongoose');
const Student = require('./models/students');

mongoose.connect('mongodb://127.0.0.1:27017/jrmsu_appointments')
  .then(async () => {
    try {
      const count = await Student.deleteMany({});
      console.log(`Deleted ${count.deletedCount} students`);
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
