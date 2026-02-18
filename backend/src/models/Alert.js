const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  tripId: {
    type: String,
    required: true,
    ref: 'Trip'
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['DEVIATION', 'STOP', 'SOS', 'TRIP_COMPLETE'],
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  description: {
    type: String
  },
  isSent: {
    type: Boolean,
    default: false
  },
  isAcknowledged: {
    type: Boolean,
    default: false
  },
  isCancelled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
alertSchema.index({ userId: 1, timestamp: -1 });
alertSchema.index({ tripId: 1, timestamp: -1 });
alertSchema.index({ type: 1, isCancelled: 1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert; 