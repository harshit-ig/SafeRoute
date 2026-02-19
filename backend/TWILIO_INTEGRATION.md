# Twilio WhatsApp Integration for SafeRoute

## Overview
SafeRoute now includes real-time location tracking with WhatsApp notifications powered by Twilio. The system automatically:
- Saves location updates every 10-20 seconds to the database
- Sends periodic WhatsApp updates every 5 minutes during active trips
- Sends immediate SOS alerts to all safety circle members
- Notifies circle members when trips start and complete

## Features

### 1. **Live Location Tracking**
- Location updates stored in MongoDB every 10-20 seconds
- Includes GPS coordinates, speed, heading, altitude, and battery level
- Historical location data with 30-day auto-deletion (TTL)

### 2. **WhatsApp Notifications**
- **Trip Start**: Notifies circle members when a trip begins
- **Periodic Updates**: Sends location updates every 5 minutes during trip
- **SOS Alerts**: Immediate emergency alerts with live location
- **Trip Complete**: Confirmation when trip ends safely
- **Route Deviations**: Alerts when user goes off planned route

### 3. **Database Storage**
All location updates are stored in the `LocationTracking` collection with:
- Trip ID and User ID references
- GPS coordinates (latitude, longitude)
- Speed, heading, altitude
- Timestamp and battery level
- Movement status

## Setup Instructions

### Step 1: Get Twilio Account

1. **Sign up** at [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. **Get free trial credits** ($15 USD to test)
3. **Get your credentials** from [Twilio Console](https://console.twilio.com/):
   - Account SID
   - Auth Token

### Step 2: Configure WhatsApp Sandbox

1. Go to [WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. Send the **join code** from your WhatsApp to the Twilio number
   - Example: Send "join <your-code>" to +1 415 523 8886
3. **Note the WhatsApp number** (usually `whatsapp:+14155238886`)

### Step 3: Get a Phone Number

1. Go to [Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. **Buy a number** with SMS capability
3. **Copy the phone number** (E.164 format: +1234567890)

### Step 4: Configure Backend

Update `backend/.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Step 5: Test the Integration

Restart the backend server:
```bash
cd backend
node src/server.js
```

## API Endpoints

### Location Tracking

#### **POST /api/location/track**
Save location update and send periodic WhatsApp notifications

**Request Body:**
```json
{
  "tripId": "trip_123",
  "userId": "user_123",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "speed": 5.5,
  "heading": 180,
  "altitude": 10,
  "batteryLevel": 85,
  "isMoving": true
}
```

**Response:**
```json
{
  "success": true,
  "locationSaved": true,
  "whatsappSent": true,
  "recipientCount": 3,
  "message": "Location saved and updates sent"
}
```

#### **POST /api/location/sos**
Send immediate SOS alert via WhatsApp

**Request Body:**
```json
{
  "userId": "user_123",
  "tripId": "trip_123",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "message": "I need help!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SOS alert sent successfully",
  "alertsSent": 3,
  "totalRecipients": 3
}
```

#### **POST /api/location/start-tracking**
Start automatic location tracking for a trip

**Request Body:**
```json
{
  "tripId": "trip_123",
  "userId": "user_123"
}
```

#### **POST /api/location/stop-tracking**
Stop location tracking

**Request Body:**
```json
{
  "tripId": "trip_123"
}
```

#### **GET /api/location/trip/:tripId**
Get location history for a trip

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)
- `startTime` (optional): Start timestamp
- `endTime` (optional): End timestamp

**Response:**
```json
{
  "success": true,
  "count": 50,
  "locations": [
    {
      "id": "loc_123",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "speed": 5.5,
      "timestamp": "2026-02-19T10:30:00Z"
    }
  ]
}
```

## Configuration

### Update Intervals

Edit `backend/src/services/locationTrackingService.js`:

```javascript
const UPDATE_CONFIG = {
  LOCATION_SAVE_INTERVAL: 10000,      // 10 seconds
  WHATSAPP_UPDATE_INTERVAL: 300000,   // 5 minutes
  SOS_IMMEDIATE: true,
  DEVIATION_IMMEDIATE: true
};
```

### Message Templates

WhatsApp messages can be customized in `backend/src/services/twilioService.js`:

- `sendLiveLocationUpdate` - Live location updates
- `sendPeriodicLocationUpdate` - Periodic trip updates  
- `sendEmergencyAlert` - SOS alerts
- `sendTripUpdate` - Trip start/complete notifications

## Database Schema

### LocationTracking Collection

```javascript
{
  id: String,              // Unique identifier
  tripId: String,          // Reference to Trip
  userId: String,          // Reference to User
  latitude: Number,        // GPS latitude
  longitude: Number,       // GPS longitude
  accuracy: Number,        // GPS accuracy in meters
  speed: Number,           // Speed in m/s
  heading: Number,         // Direction (0-360 degrees)
  altitude: Number,        // Altitude in meters
  timestamp: Date,         // When location was captured
  batteryLevel: Number,    // Battery percentage
  isMoving: Boolean,       // Movement status
  createdAt: Date,         // Auto-generated
  updatedAt: Date          // Auto-generated
}
```

**Indexes:**
- `tripId + timestamp` (for efficient querying)
- `userId + timestamp` (for user history)
- TTL index on `createdAt` (auto-delete after 30 days)

## Testing

### Test with Postman

1. **Start a trip** (triggers tracking):
```
POST http://localhost:5000/api/trips/start
```

2. **Send location updates** every 10-20 seconds:
```
POST http://localhost:5000/api/location/track
```

3. **Trigger SOS**:
```
POST http://localhost:5000/api/location/sos
```

4. **Complete trip** (stops tracking):
```
POST http://localhost:5000/api/trips/:tripId/complete
```

### Check WhatsApp

All safety circle members should receive:
- Trip start notification
- Location updates every 5 minutes
- SOS alerts immediately
- Trip completion notification

## Production Considerations

### 1. **Upgrade Twilio Account**
- Free trial has limitations
- Production needs a paid account
- Budget for WhatsApp/SMS costs

### 2. **WhatsApp Business API**
- Sandbox is for testing only
- Use WhatsApp Business API for production
- Requires approval from Meta/Twilio

### 3. **Rate Limiting**
- Implement rate limits on location updates
- Batch notifications when possible
- Monitor Twilio usage and costs

### 4. **Database Optimization**
- Index frequently queried fields
- Implement data archiving strategy
- Consider time-series database for high volume

### 5. **Error Handling**
- Retry failed WhatsApp messages
- Fall back to SMS if WhatsApp fails
- Log all notification attempts

## Troubleshooting

### WhatsApp Messages Not Sending

1. **Check Twilio credentials** in `.env`
2. **Verify phone numbers** are in E.164 format (+1234567890)
3. **Join WhatsApp Sandbox** from all recipient phones
4. **Check Twilio logs** at [Twilio Console](https://console.twilio.com/us1/monitor/logs/sms)

### Location Not Saving

1. **Verify trip is ACTIVE** status
2. **Check MongoDB connection**
3. **View server logs** for errors
4. **Ensure required fields** are in request

### No Periodic Updates

1. **Check UPDATE_CONFIG** intervals
2. **Verify tracking started** with `/start-tracking`
3. **Check circle members** exist
4. **Monitor server logs** for errors

## Cost Estimation

### Twilio Pricing (as of 2026)
- **WhatsApp Messages**: $0.005 - $0.02 per message
- **SMS**: $0.0075 per message (varies by country)
- **Phone Number**: ~$1/month

### Example Monthly Cost
For 1 user with 3 circle members:
- 2 trips/day × 12 updates/trip × 3 members = 72 messages/day
- 72 × 30 days × $0.01 = **$21.60/month**

## Security

- **Never commit** `.env` file to git
- **Rotate credentials** regularly
- **Use environment variables** in production
- **Validate phone numbers** before sending
- **Implement rate limiting** to prevent abuse

## Support

For issues or questions:
1. Check Twilio documentation: https://www.twilio.com/docs
2. View server logs: `backend/logs/`
3. Contact Twilio support: https://support.twilio.com/

## Next Steps

- [ ] Set up Twilio account
- [ ] Configure WhatsApp Sandbox
- [ ] Update `.env` with credentials
- [ ] Test with real trips
- [ ] Monitor costs and usage
- [ ] Plan production WhatsApp Business API migration
