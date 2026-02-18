const Alert = require('../models/Alert');
const User = require('../models/User');
const Trip = require('../models/Trip');
const { CircleMember } = require('../models/SafeCircle');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const twilioService = require('../services/twilioService');

/**
 * @desc    Create and send a new alert
 * @route   POST /api/alerts
 * @access  Private
 */
const createAlert = asyncHandler(async (req, res) => {
  const { id, tripId, userId, type, latitude, longitude, timestamp, description } = req.body;
  
  // Check if trip exists
  const trip = await Trip.findOne({ id: tripId });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  
  // Check if user exists
  const user = await User.findOne({ id: userId });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Create alert
  const alert = await Alert.create({
    id,
    tripId,
    userId,
    type,
    latitude,
    longitude,
    timestamp: timestamp || new Date(),
    description
  });
  
  if (!alert) {
    res.status(400);
    throw new Error('Invalid alert data');
  }
  
  // Update trip statistics based on alert type
  if (type === 'DEVIATION') {
    trip.deviationCount += 1;
    await trip.save();
  } else if (type === 'STOP') {
    trip.stopCount += 1;
    await trip.save();
  }
  
  trip.alertCount += 1;
  await trip.save();
  
  // Send alert to all circle members if user has a group
  if (user.groupCode) {
    // Get all circle members except the user who triggered the alert
    const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
    const memberIds = memberDocs.map(member => member.userId).filter(id => id !== userId);
    const circleMembers = await User.find({ id: { $in: memberIds } });
    
    if (circleMembers.length > 0) {
      // Format alert message
      let message;
      if (type === 'SOS') {
        message = `🚨 EMERGENCY ALERT: ${user.name} has triggered an SOS alert! Location: https://maps.google.com/?q=${latitude},${longitude}`;
      } else if (type === 'DEVIATION') {
        message = `⚠️ ROUTE DEVIATION: ${user.name} has deviated from their planned route. Location: https://maps.google.com/?q=${latitude},${longitude}`;
      } else if (type === 'STOP') {
        message = `⏸️ UNEXPECTED STOP: ${user.name}'s trip has stopped unexpectedly. Location: https://maps.google.com/?q=${latitude},${longitude}`;
      } else {
        message = `📢 ALERT: ${user.name} has triggered a ${type} alert. Location: https://maps.google.com/?q=${latitude},${longitude}`;
      }
      
      // Add description if available
      if (description) {
        message += `\nDetails: ${description}`;
      }
      
      // Send SMS alerts to all circle members
      for (const member of circleMembers) {
        try {
          // Use the new emergency alert function
          await twilioService.sendEmergencyAlert(member.phone, message);
        } catch (error) {
          console.error(`Failed to send alert to member ${member.phone}:`, error);
        }
      }
      
      // Mark alert as sent
      alert.isSent = true;
      await alert.save();
    }
  }
  
  // Send WebSocket notification if socket.io is available
  const io = req.app.get('io');
  if (io && user.groupCode) {
    io.to(user.groupCode).emit('alert', {
      id: alert.id,
      userId: alert.userId,
      tripId: alert.tripId,
      type: alert.type,
      latitude: alert.latitude,
      longitude: alert.longitude,
      timestamp: alert.timestamp,
      userName: user.name
    });
  }
  
  res.status(201).json({
    id: alert.id,
    tripId: alert.tripId,
    type: alert.type,
    timestamp: alert.timestamp,
    isSent: alert.isSent,
    message: 'Alert created and sent successfully'
  });
});

/**
 * @desc    Cancel an alert
 * @route   POST /api/alerts/:alertId/cancel
 * @access  Private
 */
const cancelAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({ id: req.params.alertId });
  
  if (!alert) {
    res.status(404);
    throw new Error('Alert not found');
  }
  
  if (alert.type !== 'SOS') {
    res.status(400);
    throw new Error('Only SOS alerts can be cancelled');
  }
  
  if (alert.isCancelled) {
    res.status(400);
    throw new Error('Alert already cancelled');
  }
  
  // Mark alert as cancelled
  alert.isCancelled = true;
  await alert.save();
  
  // Send cancellation message to all circle members
  const user = await User.findOne({ id: alert.userId });
  
  if (user && user.groupCode) {
    // Get all circle members except the user who triggered the alert
    const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
    const memberIds = memberDocs.map(member => member.userId).filter(id => id !== alert.userId);
    const circleMembers = await User.find({ id: { $in: memberIds } });
    
    for (const member of circleMembers) {
      try {
        const message = `✅ ALL CLEAR: ${user.name} has cancelled their emergency alert. They are safe now.`;
        await twilioService.sendEmergencyAlert(member.phone, message);
      } catch (error) {
        console.error(`Failed to send cancellation to member ${member.phone}:`, error);
      }
    }
  }
  
  // Send WebSocket notification if socket.io is available
  const io = req.app.get('io');
  if (io && user && user.groupCode) {
    io.to(user.groupCode).emit('alert_cancelled', {
      id: alert.id,
      userId: alert.userId
    });
  }
  
  res.status(200).json({
    id: alert.id,
    tripId: alert.tripId,
    type: alert.type,
    isCancelled: alert.isCancelled,
    message: 'Alert cancelled successfully'
  });
});

/**
 * @desc    Get all alerts for a trip
 * @route   GET /api/alerts/trip/:tripId
 * @access  Private
 */
const getTripAlerts = asyncHandler(async (req, res) => {
  const alerts = await Alert.find({ tripId: req.params.tripId })
    .sort({ timestamp: -1 });
  
  res.status(200).json(alerts);
});

/**
 * @desc    Get recent alerts for a user
 * @route   GET /api/alerts/user/:userId
 * @access  Private
 */
const getUserAlerts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  const alerts = await Alert.find({ userId: req.params.userId })
    .sort({ timestamp: -1 })
    .limit(limit);
  
  res.status(200).json(alerts);
});

/**
 * @desc    Acknowledge an alert (mark as seen)
 * @route   POST /api/alerts/:alertId/acknowledge
 * @access  Private
 */
const acknowledgeAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({ id: req.params.alertId });
  
  if (!alert) {
    res.status(404);
    throw new Error('Alert not found');
  }
  
  alert.isAcknowledged = true;
  await alert.save();
  
  res.status(200).json({
    id: alert.id,
    isAcknowledged: alert.isAcknowledged,
    message: 'Alert acknowledged'
  });
});

module.exports = {
  createAlert,
  cancelAlert,
  getTripAlerts,
  getUserAlerts,
  acknowledgeAlert
}; 