const LocationTracking = require('../models/LocationTracking');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { CircleMember } = require('../models/SafeCircle');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const twilioService = require('../services/twilioService');
const locationTrackingService = require('../services/locationTrackingService');

/**
 * @desc    Save location update during active trip
 * @route   POST /api/location/track
 * @access  Private
 */
const trackLocation = asyncHandler(async (req, res) => {
  const {
    id,
    tripId,
    userId,
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    altitude,
    timestamp,
    batteryLevel,
    isMoving
  } = req.body;

  // Validate required fields
  if (!tripId || !userId || latitude === undefined || longitude === undefined) {
    res.status(400);
    throw new Error('Missing required fields: tripId, userId, latitude, longitude');
  }

  // Check if trip exists and is active
  const trip = await Trip.findOne({ id: tripId });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  if (trip.status !== 'ACTIVE') {
    res.status(400);
    throw new Error('Trip is not active');
  }

  // Process location update through the tracking service
  const result = await locationTrackingService.processLocationUpdate({
    id: id || `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tripId,
    userId,
    latitude,
    longitude,
    accuracy: accuracy || 0,
    speed: speed || 0,
    heading: heading || 0,
    altitude: altitude || 0,
    timestamp: timestamp || new Date(),
    batteryLevel: batteryLevel || null,
    isMoving: isMoving !== undefined ? isMoving : true
  });

  res.status(201).json({
    success: true,
    locationSaved: result.locationSaved,
    whatsappSent: result.whatsappSent,
    recipientCount: result.recipientCount || 0,
    message: result.whatsappSent ? 'Location saved and updates sent' : 'Location saved'
  });
});

/**
 * @desc    Get location history for a trip
 * @route   GET /api/location/trip/:tripId
 * @access  Private
 */
const getTripLocationHistory = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { limit = 100, startTime, endTime } = req.query;

  const query = { tripId };
  
  // Add time range filters if provided
  if (startTime || endTime) {
    query.timestamp = {};
    if (startTime) query.timestamp.$gte = new Date(startTime);
    if (endTime) query.timestamp.$lte = new Date(endTime);
  }

  const locations = await LocationTracking.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: locations.length,
    locations: locations.map(loc => ({
      id: loc.id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed,
      heading: loc.heading,
      timestamp: loc.timestamp,
      isMoving: loc.isMoving
    }))
  });
});

/**
 * @desc    Get latest location for a user
 * @route   GET /api/location/user/:userId/latest
 * @access  Private
 */
const getLatestUserLocation = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const location = await LocationTracking.findOne({ userId })
    .sort({ timestamp: -1 });

  if (!location) {
    res.status(404);
    throw new Error('No location data found for this user');
  }

  res.status(200).json({
    success: true,
    location: {
      id: location.id,
      tripId: location.tripId,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      heading: location.heading,
      timestamp: location.timestamp,
      isMoving: location.isMoving,
      accuracy: location.accuracy,
      altitude: location.altitude,
      batteryLevel: location.batteryLevel
    }
  });
});

/**
 * @desc    Get current authenticated user's latest location
 * @route   GET /api/location/current
 * @access  Private
 */
const getCurrentLocation = asyncHandler(async (req, res) => {
  // req.user is set by the protect middleware
  const userId = req.user.id;

  const location = await LocationTracking.findOne({ userId })
    .sort({ timestamp: -1 });

  if (!location) {
    return res.status(404).json({
      success: false,
      message: 'No location data found. Please start a trip to begin tracking.'
    });
  }

  // Also get the associated trip information
  const trip = await Trip.findOne({ id: location.tripId });

  res.status(200).json({
    success: true,
    location: {
      id: location.id,
      tripId: location.tripId,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      heading: location.heading,
      timestamp: location.timestamp,
      isMoving: location.isMoving,
      accuracy: location.accuracy,
      altitude: location.altitude,
      batteryLevel: location.batteryLevel
    },
    trip: trip ? {
      id: trip.id,
      status: trip.status,
      sourceAddress: trip.sourceAddress,
      destinationAddress: trip.destinationAddress,
      startTime: trip.startTime
    } : null
  });
});

/**
 * @desc    Update current location (simplified version)
 * @route   POST /api/location/current
 * @access  Private
 */
const updateCurrentLocation = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    altitude,
    batteryLevel
  } = req.body;

  // Validate required fields
  if (latitude === undefined || longitude === undefined) {
    res.status(400);
    throw new Error('Missing required fields: latitude, longitude');
  }

  // Get user's active trip
  const activeTrip = await Trip.findOne({ 
    userId, 
    status: 'ACTIVE' 
  });

  if (!activeTrip) {
    return res.status(400).json({
      success: false,
      message: 'No active trip found. Please start a trip first.'
    });
  }

  // Process location update through the tracking service
  const result = await locationTrackingService.processLocationUpdate({
    id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tripId: activeTrip.id,
    userId,
    latitude,
    longitude,
    accuracy: accuracy || 0,
    speed: speed || 0,
    heading: heading || 0,
    altitude: altitude || 0,
    timestamp: new Date(),
    batteryLevel: batteryLevel || null,
    isMoving: speed > 0.5 // Consider moving if speed > 0.5 m/s
  });

  res.status(200).json({
    success: true,
    locationSaved: result.locationSaved,
    whatsappSent: result.whatsappSent,
    recipientCount: result.recipientCount || 0,
    tripId: activeTrip.id,
    message: result.whatsappSent ? 'Location updated and notifications sent' : 'Location updated'
  });
});

/**
 * @desc    Send SOS alert with live location to circle members via WhatsApp
 * @route   POST /api/location/sos
 * @access  Private
 */
const sendSOSWithLocation = asyncHandler(async (req, res) => {
  const {
    userId,
    tripId,
    latitude,
    longitude,
    message
  } = req.body;

  // Validate required fields
  if (!userId || !latitude || !longitude) {
    res.status(400);
    throw new Error('Missing required fields: userId, latitude, longitude');
  }

  // Use the location tracking service to send SOS
  const result = await locationTrackingService.sendSOSAlert({
    userId,
    tripId,
    latitude,
    longitude,
    message
  });

  if (!result.success) {
    res.status(400);
    throw new Error(result.error || 'Failed to send SOS alert');
  }

  res.status(200).json({
    success: true,
    message: 'SOS alert sent successfully',
    alertsSent: result.alertsSent,
    totalRecipients: result.totalRecipients,
    results: result.results
  });
});

/**
 * @desc    Send live location updates to circle members via WhatsApp
 * @route   POST /api/location/share
 * @access  Private
 */
const shareLiveLocation = asyncHandler(async (req, res) => {
  const { userId, tripId } = req.body;

  // Get latest location
  const location = await LocationTracking.findOne({ userId, tripId })
    .sort({ timestamp: -1 });

  if (!location) {
    res.status(404);
    throw new Error('No location data found');
  }

  // Get user and circle members
  const user = await User.findOne({ id: userId });
  if (!user || !user.groupCode) {
    res.status(400);
    throw new Error('User not in any safety circle');
  }

  const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
  const memberIds = memberDocs.map(member => member.userId).filter(id => id !== userId);
  const circleMembers = await User.find({ id: { $in: memberIds } });

  const mapsLink = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  const shareMessage = `📍 Live Location Update\n\n${user.name} is currently at:\n${mapsLink}\n\nSpeed: ${(location.speed * 3.6).toFixed(1)} km/h\nTime: ${new Date(location.timestamp).toLocaleString()}\n\nTracking active trip.`;

  const results = [];
  for (const member of circleMembers) {
    try {
      const result = await twilioService.sendWhatsAppMessage(member.phone, shareMessage);
      results.push({ memberName: member.name, success: result.success });
    } catch (error) {
      results.push({ memberName: member.name, success: false });
    }
  }

  res.status(200).json({
    success: true,
    shared: results.filter(r => r.success).length,
    total: circleMembers.length
  });
});

/**
 * @desc    Start location tracking for a trip
 * @route   POST /api/location/start-tracking
 * @access  Private
 */
const startTracking = asyncHandler(async (req, res) => {
  const { tripId, userId } = req.body;

  if (!tripId || !userId) {
    res.status(400);
    throw new Error('Missing required fields: tripId, userId');
  }

  const result = await locationTrackingService.startLocationTracking(tripId, userId);

  res.status(200).json(result);
});

/**
 * @desc    Stop location tracking for a trip
 * @route   POST /api/location/stop-tracking
 * @access  Private
 */
const stopTracking = asyncHandler(async (req, res) => {
  const { tripId } = req.body;

  if (!tripId) {
    res.status(400);
    throw new Error('Missing required field: tripId');
  }

  const result = locationTrackingService.stopLocationTracking(tripId);

  res.status(200).json(result);
});

/**
 * @desc    Get tracking statistics
 * @route   GET /api/location/stats
 * @access  Private
 */
const getTrackingStats = asyncHandler(async (req, res) => {
  const stats = locationTrackingService.getTrackerStats();

  res.status(200).json({
    success: true,
    stats
  });
});

module.exports = {
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
};
