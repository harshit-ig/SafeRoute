const mongoose = require('mongoose');

/**
 * LocationTracking Schema
 * Stores live location updates during active trips
 * Updates are stored every 10-20 seconds for real-time tracking
 */
const locationTrackingSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  tripId: {
    type: String,
    required: true,
    ref: 'Trip',
    index: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  accuracy: {
    type: Number, // GPS accuracy in meters
    default: 0
  },
  speed: {
    type: Number, // Speed in m/s
    default: 0
  },
  heading: {
    type: Number, // Direction in degrees (0-360)
    default: 0
  },
  altitude: {
    type: Number, // Altitude in meters
    default: 0
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  batteryLevel: {
    type: Number, // Battery percentage (0-100)
    default: null
  },
  isMoving: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying by trip and time
locationTrackingSchema.index({ tripId: 1, timestamp: -1 });
locationTrackingSchema.index({ userId: 1, timestamp: -1 });

// TTL index to automatically delete old location data after 30 days
locationTrackingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const LocationTracking = mongoose.model('LocationTracking', locationTrackingSchema);

module.exports = LocationTracking;
