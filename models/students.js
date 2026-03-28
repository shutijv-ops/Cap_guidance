const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true
  },
  middleName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    required: true
  },
  sex: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: ''
  },
  suffix: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  course: {
    type: String,
    default: ''
  },
  year: {
    type: String,
    default: ''
  },
  contact: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  passwordChanged: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function(inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

// Method to set password changed flag
studentSchema.methods.setPasswordChanged = function() {
  this.passwordChanged = true;
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Student', studentSchema);
