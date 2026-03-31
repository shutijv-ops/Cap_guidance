const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  refId: { type: String, required: true, unique: true },
  // Referrer (person submitting the referral)
  referrerName: { type: String, required: true },
  referrerStudentId: { type: String, required: true },
  referrerEmail: { type: String, required: true },
  relationship: { type: String, default: '' },

  // Student of concern
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  studentCourseYearSection: { type: String, default: '' },
  studentAware: { type: String, enum: ['Yes','No','Not Sure'], default: 'Not Sure' },

  // Concern
  concernTypes: { type: [String], default: [] },
  description: { type: String, maxlength: 500 },
  urgency: { type: String, enum: ['Low','High'], default: 'Low' },

  // Workflow
  status: { type: String, enum: ['Pending','Reviewed','Action Taken','Cancelled'], default: 'Pending' },
  counselorNotes: { type: String, default: '' },

  // Metadata
  submittedByStudentId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Referral', referralSchema);
