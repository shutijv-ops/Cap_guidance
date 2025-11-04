const mongoose = require('mongoose');

const counselorSchema = new mongoose.Schema({
  title: {
    type: String,
    enum: ['Mr.', 'Mrs.', 'Ms.', 'Dr.'],
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  middleName: String,
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'Guidance Counselor'
  },
  status: {
    type: String,
    enum: ['Active', 'On Leave', 'Inactive'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for full name
counselorSchema.virtual('fullName').get(function() {
  const middle = this.middleName ? ` ${this.middleName.charAt(0)}. ` : ' ';
  return `${this.title} ${this.firstName}${middle}${this.lastName}`;
});

module.exports = mongoose.model('Counselor', counselorSchema);