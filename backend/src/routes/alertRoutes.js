const express = require('express');
const {
  createAlert,
  cancelAlert,
  getTripAlerts,
  getUserAlerts,
  acknowledgeAlert
} = require('../controllers/alertController');
const { protect } = require('../middlewares/authMiddleware');
const summaryController = require('../controllers/summaryController');

const router = express.Router();

// All alert routes should be protected
router.use(protect);

// POST /api/alerts
router.post('/', createAlert);

// POST /api/alerts/:alertId/cancel
router.post('/:alertId/cancel', cancelAlert);

// POST /api/alerts/:alertId/acknowledge
router.post('/:alertId/acknowledge', acknowledgeAlert);

// GET /api/alerts/trip/:tripId
router.get('/trip/:tripId', getTripAlerts);

// GET /api/alerts/user/:userId
router.get('/user/:userId', getUserAlerts);

// Add summary route to trigger manual daily summary generation
router.post('/summaries/generate', summaryController.generateDailySummaries);
router.post('/summaries/user/:userId', summaryController.generateUserSummary);

module.exports = router; 