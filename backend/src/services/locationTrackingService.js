const LocationTracking = require('../models/LocationTracking');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { CircleMember } = require('../models/SafeCircle');
const twilioService = require('./twilioService');

/**
 * Configuration for location update frequency
 */
const UPDATE_CONFIG = {
  LOCATION_SAVE_INTERVAL: 10000, // Save to DB every 10 seconds
  WHATSAPP_UPDATE_INTERVAL: 300000, // Send WhatsApp updates every 5 minutes (300000 ms)
  SOS_IMMEDIATE: true, // Send SOS alerts immediately
  DEVIATION_IMMEDIATE: true // Send deviation alerts immediately
};

/**
 * Active trip trackers
 * Format: { tripId: { timer: NodeJS.Timer, lastUpdate: Date } }
 */
const activeTrackers = new Map();

/**
 * Start tracking location for an active trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 */
const startLocationTracking = async (tripId, userId) => {
  try {
    // Stop existing tracker if any
    if (activeTrackers.has(tripId)) {
      stopLocationTracking(tripId);
    }

    console.log(`[LocationTracker] Starting location tracking for trip ${tripId}`);

    // Set up tracker
    activeTrackers.set(tripId, {
      lastUpdate: new Date(),
      lastWhatsAppUpdate: new Date(),
      userId
    });

    return {
      success: true,
      message: 'Location tracking started',
      tripId
    };
  } catch (error) {
    console.error(`[LocationTracker] Error starting tracking for trip ${tripId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Stop tracking location for a trip
 * @param {string} tripId - Trip ID
 */
const stopLocationTracking = (tripId) => {
  if (activeTrackers.has(tripId)) {
    const tracker = activeTrackers.get(tripId);
    console.log(`[LocationTracker] Stopping location tracking for trip ${tripId}`);
    activeTrackers.delete(tripId);
    
    return {
      success: true,
      message: 'Location tracking stopped'
    };
  }
  
  return {
    success: false,
    message: 'No active tracker found for this trip'
  };
};

/**
 * Process incoming location update
 * Saves to database and sends WhatsApp updates as needed
 * @param {object} locationData - Location update data
 */
const processLocationUpdate = async (locationData) => {
  const { tripId, userId, latitude, longitude, speed, timestamp } = locationData;

  try {
    // Get trip and user data
    const [trip, user] = await Promise.all([
      Trip.findOne({ id: tripId }),
      User.findOne({ id: userId })
    ]);

    if (!trip || !user) {
      console.error(`[LocationTracker] Trip or user not found for update`);
      return { success: false, error: 'Trip or user not found' };
    }

    // Save location to database
    const savedLocation = await LocationTracking.create({
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...locationData,
      timestamp: timestamp || new Date()
    });

    // Update trip's last location update time
    trip.lastLocationUpdate = new Date();
    await trip.save();

    // Check if we should send WhatsApp update
    const tracker = activeTrackers.get(tripId);
    if (!tracker) {
      // Trip not being actively tracked
      return { success: true, locationSaved: true, whatsappSent: false };
    }

    const timeSinceLastWhatsApp = Date.now() - (tracker.lastWhatsAppUpdate || 0);
    const shouldSendWhatsApp = timeSinceLastWhatsApp >= UPDATE_CONFIG.WHATSAPP_UPDATE_INTERVAL;

    if (shouldSendWhatsApp && user.groupCode) {
      // Get circle members
      const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
      const memberIds = memberDocs.map(m => m.userId).filter(id => id !== userId);
      const members = await User.find({ id: { $in: memberIds } });

      if (members.length > 0) {
        // Send periodic location updates via WhatsApp
        const updateData = {
          userName: user.name,
          latitude,
          longitude,
          speed,
          timestamp: timestamp || new Date(),
          destination: trip.destinationAddress,
          estimatedTimeRemaining: 'Calculating...' // You can calculate this based on distance and speed
        };

        const sendPromises = members.map(member =>
          twilioService.sendPeriodicLocationUpdate(member.phone, updateData)
            .catch(err => {
              console.error(`[LocationTracker] Failed to send update to ${member.phone}:`, err);
              return { success: false, error: err.message };
            })
        );

        await Promise.all(sendPromises);

        // Update last WhatsApp update time
        tracker.lastWhatsAppUpdate = Date.now();
        activeTrackers.set(tripId, tracker);

        // Update trip
        trip.lastNotificationSent = new Date();
        await trip.save();

        console.log(`[LocationTracker] Sent periodic WhatsApp updates to ${members.length} members`);

        return {
          success: true,
          locationSaved: true,
          whatsappSent: true,
          recipientCount: members.length
        };
      }
    }

    return {
      success: true,
      locationSaved: true,
      whatsappSent: false,
      reason: shouldSendWhatsApp ? 'No circle members' : 'Update interval not reached'
    };

  } catch (error) {
    console.error(`[LocationTracker] Error processing location update:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send immediate SOS alert with location
 * @param {object} sosData - SOS alert data
 */
const sendSOSAlert = async (sosData) => {
  const { userId, tripId, latitude, longitude, message } = sosData;

  try {
    const user = await User.findOne({ id: userId });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Save SOS location
    await LocationTracking.create({
      id: `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tripId: tripId || 'SOS_NO_TRIP',
      userId,
      latitude,
      longitude,
      timestamp: new Date(),
      isMoving: false
    });

    if (!user.groupCode) {
      return { success: false, error: 'User not in any safety circle' };
    }

    // Get circle members
    const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
    const memberIds = memberDocs.map(m => m.userId).filter(id => id !== userId);
    const members = await User.find({ id: { $in: memberIds } });

    if (members.length === 0) {
      return { success: false, error: 'No circle members found' };
    }

    // Create SOS message
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
    const sosMessage = `🆘 EMERGENCY SOS ALERT 🆘\n\n` +
      `${user.name} needs immediate help!\n\n` +
      `📍 Live Location: ${mapsLink}\n` +
      `📞 Contact: ${user.phone}\n` +
      `${message ? `💬 Message: ${message}\n` : ''}` +
      `🕐 Time: ${new Date().toLocaleString()}\n\n` +
      `⚠️ Please check on them immediately!`;

    // Send to all members immediately
    const results = await Promise.all(
      members.map(member =>
        twilioService.sendWhatsAppMessage(member.phone, sosMessage)
          .catch(err => ({ success: false, error: err.message, phone: member.phone }))
      )
    );

    const successCount = results.filter(r => r.success).length;

    console.log(`[LocationTracker] SOS alert sent to ${successCount}/${members.length} members`);

    return {
      success: true,
      alertsSent: successCount,
      totalRecipients: members.length,
      results
    };

  } catch (error) {
    console.error(`[LocationTracker] Error sending SOS alert:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get statistics for active trackers
 */
const getTrackerStats = () => {
  const activeTrips = Array.from(activeTrackers.entries()).map(([tripId, tracker]) => ({
    tripId,
    userId: tracker.userId,
    lastUpdate: tracker.lastUpdate,
    lastWhatsAppUpdate: tracker.lastWhatsAppUpdate,
    trackingDuration: Date.now() - tracker.lastUpdate.getTime()
  }));

  return {
    activeCount: activeTrackers.size,
    trips: activeTrips,
    config: UPDATE_CONFIG
  };
};

module.exports = {
  startLocationTracking,
  stopLocationTracking,
  processLocationUpdate,
  sendSOSAlert,
  getTrackerStats,
  UPDATE_CONFIG
};
