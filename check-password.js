const mongoose = require('mongoose');
const Student = require('./models/students');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/jrmsu_appointments')
  .then(async () => {
    try {
      const student = await Student.findOne({schoolId: '25-A-01465'});
      if (student) {
        // Avoid printing full password hash; show masked prefix only
        const masked = student.password ? (student.password.slice(0,6) + '...') : '';
        console.log('Password stored in DB (masked):', masked);

        // Check if it's a bcrypt hash
        const isBcryptHash = student.password && student.password.startsWith && student.password.startsWith('$2');
        console.log('Is bcrypt hash:', !!isBcryptHash);

        // Try to match against the original password "Sotillo"
        const test1 = await bcrypt.compare('Sotillo', student.password).catch(e => {
          console.log('bcrypt.compare error:', e.message);
          return false;
        });
        console.log('Matches "Sotillo":', test1);
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
