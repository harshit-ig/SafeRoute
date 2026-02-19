const Trip = require('../models/Trip');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const locationTrackingService = require('../services/locationTrackingService');
const twilioService = require('../services/twilioService');
const { CircleMember } = require('../models/SafeCircle');

/**
 * @desc    Start a new trip
 * @route   POST /api/trips/start
 * @access  Private
 */
const startTrip = asyncHandler(async (req, res) => {
  const { 
    id, 
    userId,
    sourceLatitude,
    sourceLongitude,
    destinationLatitude,
    destinationLongitude,
    sourceAddress,
    destinationAddress,
    routePolyline,
    startTime 
  } = req.body;
  
  // Validate required fields
  if (!id || !userId || !sourceAddress || !destinationAddress) {
    res.status(400);
    throw new Error('Missing required fields for trip creation');
  }
  
  // Make sure all coordinates are provided or derived from addresses
  const sourceCoords = {
    lat: sourceLatitude || 0,
    lng: sourceLongitude || 0
  };
  
  const destCoords = {
    lat: destinationLatitude || 0,
    lng: destinationLongitude || 0
  };
  
  // Generate a simple polyline if not provided
  const polyline = routePolyline || `${sourceCoords.lat},${sourceCoords.lng}|${destCoords.lat},${destCoords.lng}`;
  
  // Check if user exists
  const user = await User.findOne({ id: userId });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Check if user already has an active trip
  const activeTrip = await Trip.findOne({ 
    userId, 
    status: 'ACTIVE' 
  });
  
  if (activeTrip) {
    res.status(400);
    throw new Error('User already has an active trip');
  }
  
  // Create trip
  const trip = await Trip.create({
    id,
    userId,
    sourceLatitude: sourceCoords.lat,
    sourceLongitude: sourceCoords.lng,
    destinationLatitude: destCoords.lat,
    destinationLongitude: destCoords.lng,
    sourceAddress,
    destinationAddress,
    routePolyline: polyline,
    status: 'ACTIVE',
    startTime: startTime || new Date()
  });
  
  if (!trip) {
    res.status(400);
    throw new Error('Invalid trip data');
  }

  // Start location tracking for this trip
  await locationTrackingService.startLocationTracking(trip.id, userId);

  // Notify circle members that trip has started
  if (user.groupCode) {
    try {
      const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
      const memberIds = memberDocs.map(m => m.userId).filter(id => id !== userId);
      const members = await User.find({ id: { $in: memberIds } });

      const tripData = {
        userName: user.name,
        status: 'started',
        sourceAddress,
        destinationAddress
      };

      // Send notifications to circle members
      members.forEach(member => {
        twilioService.sendTripUpdate(member.phone, tripData)
          .catch(err => console.error(`Failed to notify ${member.phone}:`, err));
      });
    } catch (error) {
      console.error('Error notifying circle members:', error);
    }
  }
  
  res.status(201).json({
    id: trip.id,
    userId: trip.userId,
    status: trip.status,
    message: 'Trip started successfully',
    trackingEnabled: true
  });
});

/**
 * @desc    Complete a trip
 * @route   POST /api/trips/:tripId/complete
 * @access  Private
 */
const completeTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ id: req.params.tripId });
  
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  
  if (trip.status !== 'ACTIVE') {
    res.status(400);
    throw new Error('Trip is not active');
  }
  
  trip.status = 'COMPLETED';
  trip.endTime = new Date();
  await trip.save();

  // Stop location tracking
  locationTrackingService.stopLocationTracking(trip.id);

  // Notify circle members that trip completed safely
  const user = await User.findOne({ id: trip.userId });
  if (user && user.groupCode) {
    try {
      const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
      const memberIds = memberDocs.map(m => m.userId).filter(id => id !== trip.userId);
      const members = await User.find({ id: { $in: memberIds } });

      const tripData = {
        userName: user.name,
        status: 'completed',
        destinationAddress: trip.destinationAddress
      };

      // Send notifications
      members.forEach(member => {
        twilioService.sendTripUpdate(member.phone, tripData)
          .catch(err => console.error(`Failed to notify ${member.phone}:`, err));
      });
    } catch (error) {
      console.error('Error notifying circle members:', error);
    }
  }
  
  res.status(200).json({
    id: trip.id,
    userId: trip.userId,
    status: trip.status,
    message: 'Trip completed successfully',
    trackingStopped: true
  });
});

/**
 * @desc    Cancel a trip
 * @route   POST /api/trips/:tripId/cancel
 * @access  Private
 */
const cancelTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ id: req.params.tripId });
  
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  
  trip.status = 'CANCELLED';
  trip.endTime = new Date();
  await trip.save();
  
  res.status(200).json({
    id: trip.id,
    userId: trip.userId,
    status: trip.status,
    message: 'Trip cancelled successfully'
  });
});

/**
 * @desc    Get user's trips
 * @route   GET /api/trips/user/:userId
 * @access  Private
 */
const getUserTrips = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  
  // Build query
  const query = { userId: req.params.userId };
  
  // Add status filter if provided
  if (status) {
    query.status = status;
  }
  
  try {
    const trips = await Trip.find(query)
      .sort({ startTime: -1 })
      .limit(limit);
    
    res.status(200).json(trips);
  } catch (error) {
    console.error('Error fetching user trips:', error);
    res.status(500).json({ 
      message: 'Error fetching trips', 
      error: error.message 
    });
  }
});

/**
 * @desc    Get trip by ID
 * @route   GET /api/trips/:tripId
 * @access  Private
 */
const getTripById = asyncHandler(async (req, res) => {
  try {
    const trip = await Trip.findOne({ id: req.params.tripId });
    
    if (!trip) {
      res.status(404);
      throw new Error('Trip not found');
    }
    
    res.status(200).json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(error.statusCode || 500).json({ 
      message: error.message || 'Error fetching trip' 
    });
  }
});

/**
 * @desc    Get user's active trip
 * @route   GET /api/trips/user/:userId/active
 * @access  Private
 */
const getActiveTrip = asyncHandler(async (req, res) => {
  try {
    const trip = await Trip.findOne({ 
      userId: req.params.userId,
      status: 'ACTIVE'
    });
    
    if (!trip) {
      res.status(404);
      throw new Error('No active trip found');
    }
    
    res.status(200).json(trip);
  } catch (error) {
    console.error('Error fetching active trip:', error);
    res.status(error.statusCode || 500).json({ 
      message: error.message || 'Error fetching active trip' 
    });
  }
});

module.exports = {
  startTrip,
  completeTrip,
  cancelTrip,
  getUserTrips,
  getTripById,
  getActiveTrip
}; 