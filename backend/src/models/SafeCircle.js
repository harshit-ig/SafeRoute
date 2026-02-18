const mongoose = require('mongoose');

const safeCircleSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  creatorId: {
    type: String,
    required: true,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const circleMemberSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    required: true,
    ref: 'SafeCircle'
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound primary key
circleMemberSchema.index({ groupCode: 1, userId: 1 }, { unique: true });

const SafeCircle = mongoose.model('SafeCircle', safeCircleSchema);
const CircleMember = mongoose.model('CircleMember', circleMemberSchema);

module.exports = { SafeCircle, CircleMember }; 