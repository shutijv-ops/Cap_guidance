const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String },
  firstName: { type: String, default: '' },
  middleName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  email: { type: String, default: '' },
  role: { type: String, default: 'Administrator' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

adminSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Admin', adminSchema);
