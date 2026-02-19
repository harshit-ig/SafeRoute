const express = require('express');
const {
  startTrip,
  completeTrip,
  cancelTrip,
  getUserTrips,
  getTripById,
  getActiveTrip
} = require('../controllers/tripController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// All trip routes should be protected
router.use(protect);

// POST /api/trips/start
router.post('/start', startTrip);

// POST /api/trips/:tripId/complete
router.post('/:tripId/complete', completeTrip);

// POST /api/trips/:tripId/cancel
router.post('/:tripId/cancel', cancelTrip);

// GET /api/trips/user/:userId
router.get('/user/:userId', getUserTrips);

// GET /api/trips/user/:userId/active
router.get('/user/:userId/active', getActiveTrip);

// GET /api/trips/:tripId
router.get('/:tripId', getTripById);

module.exports = router; 