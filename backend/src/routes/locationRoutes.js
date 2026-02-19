const express = require('express');
const router = express.Router();
const {
  trackLocation,
  getTripLocationHistory,
  getLatestUserLocation,
  getCurrentLocation,
  updateCurrentLocation,
  sendSOSWithLocation,
  shareLiveLocation,
  startTracking,
  stopTracking,
  getTrackingStats
} = require('../controllers/locationController');
const { protect } = require('../middlewares/authMiddleware');

// All routes are protected - require authentication

// Current location endpoints (uses authenticated user)
router.get('/current', protect, getCurrentLocation);
router.post('/current', protect, updateCurrentLocation);

// Trip tracking
router.post('/track', protect, trackLocation);
router.post('/start-tracking', protect, startTracking);
router.post('/stop-tracking', protect, stopTracking);
router.get('/stats', protect, getTrackingStats);

// Location history and queries
router.get('/trip/:tripId', protect, getTripLocationHistory);
router.get('/user/:userId/latest', protect, getLatestUserLocation);

// Emergency and sharing
router.post('/sos', protect, sendSOSWithLocation);
router.post('/share', protect, shareLiveLocation);

module.exports = router;
