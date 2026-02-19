# Quick Start: Twilio WhatsApp Setup

## ⚡ 5-Minute Setup Guide

### Step 1: Create Twilio Account (2 min)
1. Go to https://www.twilio.com/try-twilio
2. Sign up (get $15 free credit)
3. Verify your email and phone

### Step 2: Get Your Credentials (1 min)
1. Go to https://console.twilio.com/
2. Copy your **Account SID** (starts with "AC")
3. Copy your **Auth Token** (click to reveal)

### Step 3: Setup WhatsApp Sandbox (1 min)
1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Send the join code from your WhatsApp:
   - Example: Send `join <your-code>` to `+1 415 523 8886`
3. You'll see "You are all set!"

### Step 4: Get Phone Number (30 sec)
1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/search
2. Search for available numbers
3. Buy one with SMS capability (free on trial)

### Step 5: Update .env File (30 sec)
Edit `backend/.env`:

```env
TWILIO_ACCOUNT_SID=AC********************************
TWILIO_AUTH_TOKEN=********************************
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Step 6: Restart Server
```bash
cd backend
node src/server.js
```

You should see:
```
✓ Twilio client initialized successfully
Connected to MongoDB
Server running on port 5000
```

## ✅ Testing

### Test 1: Start a Trip
```bash
POST http://localhost:5000/api/trips/start
```

Circle members should receive WhatsApp:
> 🚶 SafeRoute: John has started a trip from Home to Office.

### Test 2: Send Location Update
```bash
POST http://localhost:5000/api/location/track
{
  "tripId": "trip_123",
  "userId": "user_123",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "speed": 5.5
}
```

After 5 minutes, circle receives:
> 🛣️ Trip Progress Update
> John is on the way to Office
> 📍 Current Location: [Google Maps Link]

### Test 3: Send SOS
```bash
POST http://localhost:5000/api/location/sos
{
  "userId": "user_123",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "message": "Need help!"
}
```

Circle receives immediately:
> 🆘 EMERGENCY SOS ALERT 🆘
> John needs immediate help!
> 📍 Live Location: [Google Maps Link]

## 📱 Mobile App Integration

### Frontend Code Example

```typescript
// services/locationTracking.ts

import { locationApi } from './api';

let trackingInterval: NodeJS.Timer | null = null;

export const startTripTracking = async (tripId: string, userId: string) => {
  // Start tracking on backend
  await locationApi.startTracking(tripId, userId);
  
  // Send location updates every 15 seconds
  trackingInterval = setInterval(async () => {
    const location = await getCurrentLocation();
    
    await locationApi.trackLocation({
      tripId,
      userId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed || 0,
      heading: location.coords.heading || 0,
      altitude: location.coords.altitude || 0,
      accuracy: location.coords.accuracy,
      batteryLevel: await getBatteryLevel(),
      timestamp: new Date().toISOString()
    });
  }, 15000); // Every 15 seconds
};

export const stopTripTracking = async (tripId: string) => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
  await locationApi.stopTracking(tripId);
};

export const sendSOS = async (userId: string, tripId: string, message?: string) => {
  const location = await getCurrentLocation();
  
  await locationApi.sendSOS({
    userId,
    tripId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    message
  });
};
```

### API Service

```typescript
// services/api.ts

export const locationApi = {
  trackLocation: (data: LocationUpdate) =>
    api.post('/location/track', data),
  
  startTracking: (tripId: string, userId: string) =>
    api.post('/location/start-tracking', { tripId, userId }),
  
  stopTracking: (tripId: string) =>
    api.post('/location/stop-tracking', { tripId }),
  
  sendSOS: (data: SOSData) =>
    api.post('/location/sos', data),
  
  getLocationHistory: (tripId: string) =>
    api.get(`/location/trip/${tripId}`),
};
```

## 🔧 Configuration Options

### Change Update Frequency

Edit `backend/src/services/locationTrackingService.js`:

```javascript
const UPDATE_CONFIG = {
  LOCATION_SAVE_INTERVAL: 10000,      // Database: every 10 sec
  WHATSAPP_UPDATE_INTERVAL: 300000,   // WhatsApp: every 5 min
  SOS_IMMEDIATE: true,                 // SOS: instant
  DEVIATION_IMMEDIATE: true            // Deviation: instant
};
```

**Recommendations:**
- **Database**: 10-20 seconds (good accuracy)
- **WhatsApp**: 5-10 minutes (cost-effective)
- **SOS**: Always immediate
- **Deviations**: Always immediate

## 💡 Pro Tips

### 1. Add Circle Members to Sandbox
All safety circle members must join WhatsApp Sandbox:
- Send `join <code>` to `+1 415 523 8886`
- Without this, they won't receive messages

### 2. Test Phone Numbers
Use E.164 format: `+1234567890`
- ✅ Correct: `+14155551234`
- ❌ Wrong: `4155551234` or `(415) 555-1234`

### 3. Monitor Costs
- Check usage: https://console.twilio.com/us1/monitor/usage
- Set alerts for spending limits
- Trial gives $15 credit

### 4. Production Setup
For production, upgrade to:
- WhatsApp Business API (no sandbox limitations)
- Dedicated phone numbers
- Higher message volume limits

## 🚨 Troubleshooting

### "Twilio not configured" Warning
✅ Normal if you haven't added credentials yet
✅ App works, but no WhatsApp/SMS sent
➡️ Update .env with real Twilio credentials

### WhatsApp Not Received
1. Check recipient joined sandbox
2. Verify phone number format (+1234567890)
3. Check Twilio logs: https://console.twilio.com/us1/monitor/logs/sms
4. Ensure Twilio account has credits

### Location Not Saving
1. Trip must be ACTIVE status
2. Check MongoDB connection
3. View server logs for errors

### Too Many Messages / High Cost
1. Increase WHATSAPP_UPDATE_INTERVAL
2. Reduce number of circle members
3. Use updates only for important events

## 📊 What You Get

✅ **Real-time Location Tracking**
- Location saved every 10-20 seconds
- Complete trip history in database
- 30-day auto-deletion of old data

✅ **WhatsApp Notifications**
- Trip start/complete alerts
- Periodic location updates (every 5 min)
- Immediate SOS alerts
- Route deviation warnings

✅ **Safety Features**
- SOS button with instant alerts
- Google Maps links in all messages
- Battery level tracking
- Speed and heading data

✅ **Production Ready**
- Auto-scaling location tracking
- Efficient database indexes
- Graceful error handling
- SMS fallback support

## 🎯 Summary

**You now have:**
1. ✅ Complete location tracking system
2. ✅ WhatsApp integration ready
3. ✅ SOS emergency alerts
4. ✅ Automatic trip notifications
5. ✅ Cost-effective configuration
6. ✅ Production-ready code

**Total Setup Time:** 5 minutes
**Cost:** Free trial ($15 credit) then ~$20-30/month for active users

**Ready to go live!** 🚀
