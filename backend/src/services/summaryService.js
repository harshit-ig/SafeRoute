const User = require('../models/User');
const Trip = require('../models/Trip');
const Alert = require('../models/Alert');
const { CircleMember } = require('../models/SafeCircle');
const twilioService = require('./twilioService');

/**
 * Generate daily summary for a user and send to circle members
 * @param {string} userId - User ID to generate summary for
 */
const generateAndSendDailySummary = async (userId) => {
  try {
    // Get user details
    const user = await User.findOne({ id: userId });
    if (!user) {
      console.error(`User not found for ID: ${userId}`);
      return { success: false, error: 'User not found' };
    }
    
    // Check if user has a circle
    if (!user.groupCode) {
      console.log(`User ${userId} has no circle to send summary to`);
      return { success: false, error: 'User has no circle' };
    }
    
    // Get today's date range (midnight to midnight)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    // Get trips for today
    const trips = await Trip.find({
      userId: userId,
      startTime: { $gte: startOfDay, $lte: endOfDay }
    });
    
    // Get alerts for today
    const alerts = await Alert.find({
      userId: userId,
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });
    
    // Calculate statistics
    const tripCount = trips.length;
    const deviationCount = alerts.filter(alert => alert.type === 'DEVIATION').length;
    const sosCount = alerts.filter(alert => alert.type === 'SOS').length;
    
    // Format the last trip time
    let lastTripTime = 'None today';
    if (tripCount > 0) {
      const lastTrip = trips.sort((a, b) => b.startTime - a.startTime)[0];
      const lastTripDate = new Date(lastTrip.endTime || lastTrip.startTime);
      lastTripTime = lastTripDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Create summary object
    const summary = {
      userName: user.name,
      tripCount,
      deviationCount,
      sosCount,
      lastTripTime
    };
    
    // Get all circle members except the user
    const memberDocs = await CircleMember.find({ groupCode: user.groupCode });
    const memberIds = memberDocs.map(member => member.userId).filter(id => id !== userId);
    const circleMembers = await User.find({ id: { $in: memberIds } });
    
    if (circleMembers.length === 0) {
      console.log(`No other circle members found for user ${userId} with group code ${user.groupCode}`);
      return { success: false, error: 'No circle members found' };
    }
    
    // Send summary to each circle member
    const results = [];
    for (const member of circleMembers) {
      if (!member.phone) {
        console.log(`Circle member ${member.id} has no phone number`);
        results.push({ 
          memberId: member.id, 
          success: false, 
          error: 'No phone number' 
        });
        continue;
      }
      
      const result = await twilioService.sendDailySummary(member.phone, summary);
      results.push({
        memberId: member.id,
        ...result
      });
    }
    
    return {
      success: true,
      userId,
      summary,
      results
    };
  } catch (error) {
    console.error(`Error generating daily summary for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate daily summaries for all users
 * This should be scheduled to run daily
 */
const generateAllDailySummaries = async () => {
  try {
    // Get all users who have completed trips today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    
    // Find users who had trips today
    const trips = await Trip.find({
      startTime: { $gte: startOfDay }
    });
    
    // Extract unique user IDs
    const userIds = [...new Set(trips.map(trip => trip.userId))];
    
    console.log(`Generating daily summaries for ${userIds.length} users`);
    
    // Generate summaries for each user
    const results = [];
    for (const userId of userIds) {
      const result = await generateAndSendDailySummary(userId);
      results.push({
        userId,
        success: result.success,
        error: result.error
      });
    }
    
    return {
      success: true,
      totalUsers: userIds.length,
      results
    };
  } catch (error) {
    console.error('Error generating all daily summaries:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateAndSendDailySummary,
  generateAllDailySummaries
}; 