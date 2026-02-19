const twilio = require('twilio');
require('dotenv').config();

// Initialize Twilio client with credentials from environment variables
// Only initialize if credentials are properly configured
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log('Twilio client initialized successfully');
} else {
  console.warn('Twilio credentials not configured - SMS/WhatsApp features will be disabled');
}

/**
 * Send a WhatsApp message using Twilio
 * @param {string} to - Destination phone number (E.164 format: +1XXXXXXXXXX)
 * @param {string} body - Message content
 * @returns {Promise<object>} - Message SID and status
 */
const sendWhatsAppMessage = async (to, body) => {
  try {
    if (!client) {
      console.warn('Twilio not configured - WhatsApp message not sent');
      return {
        success: false,
        error: 'Twilio not configured'
      };
    }
    
    // Clean up the phone number to ensure it's in E.164 format
    const cleanTo = to.startsWith('+') ? to : `+${to}`;
    
    console.log(`Sending WhatsApp message to ${cleanTo}: ${body.substring(0, 50)}...`);
    
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${cleanTo}`,
      body
    });

    console.log(`WhatsApp message sent successfully, SID: ${message.sid}`);
    return {
      success: true,
      messageSid: message.sid,
      status: message.status
    };
  } catch (error) {
    console.error('WhatsApp message error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send an SMS using Twilio
 * @param {string} to - Destination phone number (E.164 format: +1XXXXXXXXXX)
 * @param {string} body - Message content
 * @returns {Promise<object>} - Message SID and status
 */
const sendSMS = async (to, body) => {
  try {
    if (!client) {
      console.warn('Twilio not configured - SMS not sent');
      return {
        success: false,
        error: 'Twilio not configured'
      };
    }
    
    // Clean up the phone number to ensure it's in E.164 format
    const cleanTo = to.startsWith('+') ? to : `+${to}`;
    
    console.log(`Sending SMS to ${cleanTo}: ${body.substring(0, 50)}...`);
    
    const message = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: cleanTo,
      body
    });

    console.log(`SMS sent successfully, SID: ${message.sid}`);
    return {
      success: true,
      messageSid: message.sid,
      status: message.status
    };
  } catch (error) {
    console.error('SMS error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Format alert messages based on type and data
 * @param {object} alert - Alert object
 * @param {object} user - User object
 * @returns {string} - Formatted message
 */
const formatAlertMessage = (alert, user) => {
  const mapsLink = `https://maps.google.com/?q=${alert.latitude},${alert.longitude}`;
  const name = user?.name || 'User';
  const time = new Date(alert.timestamp).toLocaleTimeString();
  
  switch(alert.type) {
    case 'DEVIATION':
      return `🚨 SafeRoute Alert: ${name} deviated from route at ${mapsLink} at ${time}`;
    
    case 'STOP':
      return `⚠️ SafeRoute Alert: ${name} stopped for 90+ seconds at unknown location: ${mapsLink}`;
    
    case 'SOS':
      return `🆘 URGENT: ${name} needs help! Location: ${mapsLink}. Call them at ${user?.phone || 'their registered number'}`;
    
    case 'TRIP_COMPLETE':
      return `✅ SafeRoute: ${name} completed trip safely at ${time}`;
    
    default:
      return `SafeRoute Alert for ${name}: ${alert.description || 'No details provided'}`;
  }
};

/**
 * Send a cancellation message for a false alarm
 * @param {string} to - Destination phone number
 * @param {string} userName - User name
 * @returns {Promise<object>} - Result of sending message
 */
const sendCancellationMessage = async (to, userName) => {
  const message = `✅ SafeRoute: ${userName} is safe. Previous alert was a false alarm and has been cancelled.`;
  
  // Try WhatsApp first, fall back to SMS
  const whatsAppResult = await sendWhatsAppMessage(to, message);
  
  if (!whatsAppResult.success) {
    console.log(`WhatsApp cancellation failed, falling back to SMS for ${to}`);
    return await sendSMS(to, message);
  }
  
  return whatsAppResult;
};

/**
 * Send a daily summary message about a user's trips and alerts
 * @param {string} to - Destination phone number
 * @param {object} summary - Summary data
 * @returns {Promise<object>} - Result of sending message
 */
const sendDailySummary = async (to, summary) => {
  const { userName, tripCount, deviationCount, sosCount, lastTripTime } = summary;
  
  const message = `📊 SafeRoute Daily Report for ${userName}:\n` +
    `• ${tripCount} trip${tripCount !== 1 ? 's' : ''} completed\n` +
    `• ${deviationCount} route deviation${deviationCount !== 1 ? 's' : ''}\n` +
    `• ${sosCount} SOS alert${sosCount !== 1 ? 's' : ''}\n` +
    `• Last trip completed at ${lastTripTime || 'N/A'}`;
  
  // Try WhatsApp first, fall back to SMS
  const whatsAppResult = await sendWhatsAppMessage(to, message);
  
  if (!whatsAppResult.success) {
    console.log(`WhatsApp summary failed, falling back to SMS for ${to}`);
    return await sendSMS(to, message);
  }
  
  return whatsAppResult;
};

/**
 * Send an emergency alert using the best available channel
 * @param {string} to - Recipient phone number (must be in E.164 format, e.g., +1XXXXXXXXXX)
 * @param {string} message - Alert message to send
 * @returns {Promise<object>} - Promise with message details or error
 */
const sendEmergencyAlert = async (to, message) => {
  try {
    // Try WhatsApp first
    const whatsAppResult = await sendWhatsAppMessage(to, message);
    
    // If WhatsApp fails, fallback to SMS
    if (!whatsAppResult.success) {
      console.log(`WhatsApp alert failed, falling back to SMS for ${to}`);
      return await sendSMS(to, message);
    }
    
    return whatsAppResult;
  } catch (error) {
    console.error(`Failed to send emergency alert to ${to}:`, error);
    
    // Last resort fallback to regular SMS
    try {
      const cleanTo = to.startsWith('+') ? to : `+${to}`;
      
      const twilioMessage = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleanTo
      });
      
      console.log(`Emergency SMS alert sent to ${to}, SID: ${twilioMessage.sid}`);
      return {
        success: true,
        sid: twilioMessage.sid,
        to: to
      };
    } catch (smsError) {
      console.error(`All alert methods failed for ${to}:`, smsError);
      return {
        success: false,
        error: error.message,
        fallbackError: smsError.message
      };
    }
  }
};

/**
 * Send trip status update to circle members
 * @param {string} to - Recipient phone number
 * @param {object} trip - Trip details
 * @returns {Promise<object>} - Promise with message details or error
 */
const sendTripUpdate = async (to, trip) => {
  try {
    const status = trip.status.toLowerCase();
    let message;
    
    if (status === 'started') {
      message = `🚶 SafeRoute: ${trip.userName} has started a trip from ${trip.sourceAddress} to ${trip.destinationAddress}.`;
    } else if (status === 'completed') {
      message = `✅ SafeRoute: ${trip.userName} has safely completed their trip to ${trip.destinationAddress}.`;
    } else {
      message = `📍 SafeRoute: ${trip.userName}'s trip status is now: ${status}.`;
    }
    
    // Try WhatsApp first
    const whatsAppResult = await sendWhatsAppMessage(to, message);
    
    // If WhatsApp fails, fallback to SMS
    if (!whatsAppResult.success) {
      console.log(`WhatsApp trip update failed, falling back to SMS for ${to}`);
      return await sendSMS(to, message);
    }
    
    return whatsAppResult;
  } catch (error) {
    console.error(`Failed to send trip update to ${to}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendWhatsAppMessage,
  sendSMS,
  formatAlertMessage,
  sendCancellationMessage,
  sendDailySummary,
  sendEmergencyAlert,
  sendTripUpdate
}; 

const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendSMS = async (to, message) => {
  try {
    return await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to
    });
  } catch (error) {
    console.error("SMS Error:", error.message);
  }
};

exports.sendWhatsApp = async (to, message) => {
  try {
    return await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP,
      to: `whatsapp:${to}`
    });
  } catch (error) {
    console.error("WhatsApp Error:", error.message);
  }
};
