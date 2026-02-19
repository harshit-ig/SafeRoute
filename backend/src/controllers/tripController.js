const Trip = require('../models/Trip');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorMiddleware');

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
    alternativePolylines,
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
    alternativePolylines: Array.isArray(alternativePolylines) ? alternativePolylines : [],
    status: 'ACTIVE',
    startTime: startTime || new Date()
  });
  
  if (!trip) {
    res.status(400);
    throw new Error('Invalid trip data');
  }
  
  res.status(201).json({
    id: trip.id,
    userId: trip.userId,
    status: trip.status,
    message: 'Trip started successfully'
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
  
  res.status(200).json({
    id: trip.id,
    userId: trip.userId,
    status: trip.status,
    message: 'Trip completed successfully'
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

// ─── Geometry helpers ───────────────────────────────────────

/** Decode Google-encoded polyline to [{latitude, longitude}] */
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/** Haversine distance in metres */
function haversine(a, b) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Perpendicular distance from point P to segment A–B (metres) */
function pointToSegmentDist(P, A, B) {
  const dx = B.longitude - A.longitude;
  const dy = B.latitude - A.latitude;
  if (dx === 0 && dy === 0) return haversine(P, A);
  let t = ((P.longitude - A.longitude) * dx + (P.latitude - A.latitude) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return haversine(P, { latitude: A.latitude + t * dy, longitude: A.longitude + t * dx });
}

/**
 * Forward-only search for the closest segment starting from `startIdx`.
 * Searches forward up to `lookAhead` segments (default 40).
 * Returns { segmentIndex, distance, progressIndex }.
 */
function findBestSegmentForward(points, userPos, startIdx, lookAhead = 40) {
  let bestDist = Infinity;
  let bestSeg = startIdx;
  const end = Math.min(startIdx + lookAhead, points.length - 1);
  for (let i = Math.max(0, startIdx - 2); i < end; i++) {
    const d = pointToSegmentDist(userPos, points[i], points[i + 1]);
    if (d < bestDist) { bestDist = d; bestSeg = i; }
  }
  const dToStart = haversine(userPos, points[bestSeg]);
  const dToEnd = haversine(userPos, points[Math.min(bestSeg + 1, points.length - 1)]);
  const progressIndex = dToEnd < dToStart ? bestSeg + 1 : bestSeg;
  return { segmentIndex: bestSeg, progressIndex: Math.max(startIdx, progressIndex), distance: bestDist };
}

/**
 * Global closest-segment search across the ENTIRE route.
 * Returns { segmentIndex, progressIndex, distance }.
 */
function findClosestSegmentGlobal(points, userPos) {
  let bestDist = Infinity;
  let bestSeg = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToSegmentDist(userPos, points[i], points[i + 1]);
    if (d < bestDist) { bestDist = d; bestSeg = i; }
  }
  const dToStart = haversine(userPos, points[bestSeg]);
  const dToEnd = haversine(userPos, points[Math.min(bestSeg + 1, points.length - 1)]);
  const progressIndex = dToEnd < dToStart ? bestSeg + 1 : bestSeg;
  return { segmentIndex: bestSeg, progressIndex, distance: bestDist };
}

/**
 * Dynamic deviation threshold (metres).
 * Uses the average spacing of nearby route points as an indicator of road density.
 * Denser points (urban) ➜ smaller threshold.  Sparser points (highway) ➜ larger threshold.
 * Clamped to [20, 80] metres.
 */
function dynamicThreshold(points, segIdx) {
  const start = Math.max(0, segIdx - 3);
  const end = Math.min(points.length - 1, segIdx + 3);
  let totalDist = 0, count = 0;
  for (let i = start; i < end; i++) {
    totalDist += haversine(points[i], points[i + 1]);
    count++;
  }
  const avgSpacing = count > 0 ? totalDist / count : 50;
  const threshold = 15 + avgSpacing * 0.55;
  return Math.max(20, Math.min(80, threshold));
}

// How many segments behind current progress counts as "going backward"
const BACKWARD_SEGMENT_TOLERANCE = 5;

// ─── updateLocation endpoint ─────────────────────────────

/**
 * @desc    Update user location during an active trip (called every few seconds)
 * @route   POST /api/trips/:tripId/location
 * @access  Private
 */
const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;

  if (latitude == null || longitude == null) {
    res.status(400);
    throw new Error('latitude and longitude are required');
  }

  const trip = await Trip.findOne({ id: req.params.tripId });
  if (!trip) { res.status(404); throw new Error('Trip not found'); }
  if (trip.status !== 'ACTIVE') { res.status(400); throw new Error('Trip is not active'); }

  // Decode ALL routes (primary + alternatives)
  const allPolylines = [trip.routePolyline, ...(trip.alternativePolylines || [])];
  const allRoutes = allPolylines.map(poly => decodePolyline(poly));

  // Primary route must be valid
  if (allRoutes[0].length < 2) {
    res.status(500);
    throw new Error('Invalid route polyline');
  }

  const userPos = { latitude, longitude };
  const prevIndex = trip.routeProgressIndex || 0;
  const prevActiveRoute = trip.activeRouteIndex || 0;

  // ── Check user against EACH route polyline ──
  // For each route, compute the best match using the same logic
  let bestRouteIdx = 0;
  let bestResult = null;

  for (let ri = 0; ri < allRoutes.length; ri++) {
    const points = allRoutes[ri];
    if (points.length < 2) continue;

    // Use saved progress only for the previously active route
    const startIdx = (ri === prevActiveRoute) ? prevIndex : 0;

    const fwd = findBestSegmentForward(points, userPos, startIdx);
    const gbl = findClosestSegmentGlobal(points, userPos);
    const fwdThreshold = dynamicThreshold(points, Math.min(fwd.progressIndex, points.length - 2));
    const gblThreshold = dynamicThreshold(points, Math.min(gbl.segmentIndex, points.length - 2));
    const fwdOnRoute = fwd.distance <= fwdThreshold;
    const gblOnRoute = gbl.distance <= gblThreshold;

    // Pick the best distance this route offers
    const closestDist = Math.min(fwd.distance, gbl.distance);

    if (fwdOnRoute || gblOnRoute) {
      // User is on this route — pick it if it's closer than any previous best
      if (!bestResult || !bestResult.onRoute || closestDist < bestResult.closestDist) {
        bestResult = { onRoute: true, fwd, gbl, fwdThreshold, gblThreshold, fwdOnRoute, gblOnRoute, points, startIdx, closestDist };
        bestRouteIdx = ri;
      }
    } else if (!bestResult || !bestResult.onRoute) {
      // All off-route so far — keep track of the closest one
      if (!bestResult || closestDist < bestResult.closestDist) {
        bestResult = { onRoute: false, fwd, gbl, fwdThreshold, gblThreshold, fwdOnRoute, gblOnRoute, points, startIdx, closestDist };
        bestRouteIdx = ri;
      }
    }
  }

  // Use the best matching route for deviation logic
  const { fwd, gbl, fwdThreshold, gblThreshold, fwdOnRoute, gblOnRoute, points, startIdx } = bestResult;
  const activePrevIndex = (bestRouteIdx === prevActiveRoute) ? prevIndex : 0;

  let finalProgressIndex = fwd.progressIndex;
  let deviated = false;
  let isGoingBackward = false;
  let bestDistance = fwd.distance;
  let usedThreshold = fwdThreshold;
  let hasJoinedRoute = trip.hasJoinedRoute || false;

  if (fwdOnRoute) {
    // Case A: Forward search found them on route → normal travel
    finalProgressIndex = fwd.progressIndex;
    deviated = false;
    bestDistance = fwd.distance;
    hasJoinedRoute = true;
  } else if (gblOnRoute && gbl.progressIndex > activePrevIndex) {
    // Case B: Not found forward, but globally close at a point AHEAD
    // → User took a SHORTCUT. Jump progress forward, not deviated.
    finalProgressIndex = gbl.progressIndex;
    deviated = false;
    bestDistance = gbl.distance;
    usedThreshold = gblThreshold;
    hasJoinedRoute = true;
  } else if (gblOnRoute && gbl.progressIndex >= 0 && !hasJoinedRoute) {
    // Case B2: User is near the route but hasn't joined yet
    // → They are approaching the route start, jump to where they are
    finalProgressIndex = gbl.progressIndex;
    deviated = false;
    bestDistance = gbl.distance;
    usedThreshold = gblThreshold;
    hasJoinedRoute = true;
  } else if (!hasJoinedRoute) {
    // Case E: User hasn't reached the route yet – still approaching
    // → Don't flag as deviated, they haven't started navigating
    finalProgressIndex = 0;
    deviated = false;
    bestDistance = gbl.distance;
    usedThreshold = gblThreshold;
  } else if (gblOnRoute && gbl.progressIndex <= activePrevIndex - BACKWARD_SEGMENT_TOLERANCE) {
    // Case C: Globally close to route but at a point significantly BEHIND progress
    // → User is going BACKWARD on the route → safety concern, flag deviated
    finalProgressIndex = activePrevIndex; // don't regress
    deviated = true;
    isGoingBackward = true;
    bestDistance = fwd.distance; // distance from the forward-expected position
    usedThreshold = fwdThreshold;
  } else {
    // Case D: Not close to route anywhere → truly deviated
    finalProgressIndex = activePrevIndex; // keep old progress
    deviated = true;
    bestDistance = Math.min(fwd.distance, gbl.distance);
  }

  // If user just went from on-route ➜ deviated, bump deviation counter
  const wasDeviated = trip.isDeviated || false;
  const newDeviationCount = (!wasDeviated && deviated)
    ? (trip.deviationCount || 0) + 1
    : (trip.deviationCount || 0);

  // Calculate remaining distance on the ACTIVE route
  const activePoints = allRoutes[bestRouteIdx];
  let remainingDist = 0;
  for (let i = finalProgressIndex; i < activePoints.length - 1; i++) {
    remainingDist += haversine(activePoints[i], activePoints[i + 1]);
  }
  if (finalProgressIndex < activePoints.length) {
    remainingDist += haversine(userPos, activePoints[finalProgressIndex]);
  }

  // Rough ETA: average speed from start, fallback 10 m/s (~36 km/h)
  const elapsed = (Date.now() - new Date(trip.startTime).getTime()) / 1000;
  let totalTravelled = 0;
  for (let i = 0; i < finalProgressIndex && i < activePoints.length - 1; i++) {
    totalTravelled += haversine(activePoints[i], activePoints[i + 1]);
  }
  const avgSpeed = elapsed > 10 ? totalTravelled / elapsed : 10;
  const etaSeconds = avgSpeed > 0.5 ? remainingDist / avgSpeed : remainingDist / 10;

  // ── Auto-complete when user reaches the destination ──
  const ARRIVAL_RADIUS_M = 150; // metres from destination to trigger arrival
  const destPos = {
    latitude: trip.destinationLatitude,
    longitude: trip.destinationLongitude,
  };
  const distToDest = haversine(userPos, destPos);
  const arrivedAtDest = distToDest <= ARRIVAL_RADIUS_M && hasJoinedRoute;

  if (arrivedAtDest) {
    trip.status = 'COMPLETED';
    trip.endTime = new Date();
  }

  // Persist
  trip.lastLatitude = latitude;
  trip.lastLongitude = longitude;
  trip.lastLocationTime = new Date();
  trip.routeProgressIndex = finalProgressIndex;
  trip.activeRouteIndex = bestRouteIdx;
  trip.isDeviated = deviated;
  trip.hasJoinedRoute = hasJoinedRoute;
  trip.distanceFromRoute = Math.round(bestDistance);
  trip.deviationCount = newDeviationCount;
  await trip.save();

  res.status(200).json({
    progressIndex: finalProgressIndex,
    isDeviated: deviated,
    isGoingBackward,
    hasJoinedRoute,
    distanceFromRoute: Math.round(bestDistance),
    threshold: Math.round(usedThreshold),
    remainingDistance: Math.round(arrivedAtDest ? 0 : remainingDist),
    etaSeconds: Math.round(arrivedAtDest ? 0 : etaSeconds),
    deviationCount: newDeviationCount,
    totalPoints: activePoints.length,
    activeRouteIndex: bestRouteIdx,
    tripCompleted: arrivedAtDest,
    distanceToDestination: Math.round(distToDest),
  });
});

module.exports = {
  startTrip,
  completeTrip,
  cancelTrip,
  getUserTrips,
  getTripById,
  getActiveTrip,
  updateLocation
}; 