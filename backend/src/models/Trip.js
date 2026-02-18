const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  sourceLatitude: {
    type: Number,
    required: true
  },
  sourceLongitude: {
    type: Number,
    required: true
  },
  destinationLatitude: {
    type: Number,
    required: true
  },
  destinationLongitude: {
    type: Number,
    required: true
  },
  sourceAddress: {
    type: String,
    required: true
  },
  destinationAddress: {
    type: String,
    required: true
  },
  routePolyline: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'PLANNED'
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  deviationCount: {
    type: Number,
    default: 0
  },
  stopCount: {
    type: Number,
    default: 0
  },
  alertCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip; 