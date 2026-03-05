const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counselor', required: false },
  username: { type: String, required: false },
  email: { type: String, required: false },
  date: { type: String, required: true }, // yyyy-mm-dd
  time: { type: String, required: false }, // optional time string e.g. '9:00 AM' or '09:00'
  createdAt: { type: Date, default: Date.now }
});

// Compound index to speed queries by counselor/date/time
leaveSchema.index({ counselor: 1, date: 1, time: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
