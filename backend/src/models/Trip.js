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
  alternativePolylines: {
    type: [String],
    default: []
  },
  activeRouteIndex: {
    type: Number,
    default: 0
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
  },
  // ─── Live tracking fields ───
  lastLatitude: {
    type: Number,
    default: null
  },
  lastLongitude: {
    type: Number,
    default: null
  },
  lastLocationTime: {
    type: Date,
    default: null
  },
  routeProgressIndex: {
    type: Number,
    default: 0
  },
  isDeviated: {
    type: Boolean,
    default: false
  },
  hasJoinedRoute: {
    type: Boolean,
    default: false
  },
  distanceFromRoute: {
    type: Number,
    default: 0
  },
  estimatedDuration: {
    type: Number,
    default: null
  },
  estimatedDistance: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip; 