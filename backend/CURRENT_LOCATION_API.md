# Current Location API Endpoints

## Overview
New simplified endpoints for getting and updating the current user's location without needing to specify user ID or trip ID explicitly.

## Endpoints

### 1. Get Current User's Latest Location

**GET** `/api/location/current`

Returns the authenticated user's most recent location data along with associated trip information.

#### Headers
```
Authorization: Bearer <your_jwt_token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "location": {
    "id": "loc_1234567890_abc123",
    "tripId": "trip_123",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "speed": 5.5,
    "heading": 180,
    "timestamp": "2026-02-19T10:30:00Z",
    "isMoving": true,
    "accuracy": 10.5,
    "altitude": 100,
    "batteryLevel": 85
  },
  "trip": {
    "id": "trip_123",
    "status": "ACTIVE",
    "sourceAddress": "123 Main St, San Francisco",
    "destinationAddress": "456 Market St, San Francisco",
    "startTime": "2026-02-19T10:00:00Z"
  }
}
```

#### Response (404 Not Found)
```json
{
  "success": false,
  "message": "No location data found. Please start a trip to begin tracking."
}
```

#### Example Usage (Frontend)
```typescript
// In your frontend service
const getCurrentLocation = async () => {
  const token = await storage.getToken();
  const response = await fetch('http://localhost:5000/api/location/current', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

---

### 2. Update Current Location (Simplified)

**POST** `/api/location/current`

Updates location for the authenticated user's active trip. Automatically finds the user's active trip.

#### Headers
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10.5,
  "speed": 5.5,
  "heading": 180,
  "altitude": 100,
  "batteryLevel": 85
}
```

**Required Fields:**
- `latitude` (Number): GPS latitude
- `longitude` (Number): GPS longitude

**Optional Fields:**
- `accuracy` (Number): GPS accuracy in meters (default: 0)
- `speed` (Number): Speed in m/s (default: 0)
- `heading` (Number): Direction in degrees 0-360 (default: 0)
- `altitude` (Number): Altitude in meters (default: 0)
- `batteryLevel` (Number): Battery percentage 0-100 (default: null)

#### Response (200 OK)
```json
{
  "success": true,
  "locationSaved": true,
  "whatsappSent": false,
  "recipientCount": 0,
  "tripId": "trip_123",
  "message": "Location updated"
}
```

If WhatsApp update was sent (every 5 minutes):
```json
{
  "success": true,
  "locationSaved": true,
  "whatsappSent": true,
  "recipientCount": 3,
  "tripId": "trip_123",
  "message": "Location updated and notifications sent"
}
```

#### Response (400 Bad Request)
```json
{
  "success": false,
  "message": "No active trip found. Please start a trip first."
}
```

#### Example Usage (Frontend)
```typescript
// In your location tracking service
const updateLocation = async (position: GeolocationPosition) => {
  const token = await storage.getToken();
  
  const response = await fetch('http://localhost:5000/api/location/current', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed || 0,
      heading: position.coords.heading || 0,
      altitude: position.coords.altitude || 0,
      batteryLevel: await getBatteryLevel()
    })
  });
  
  return response.json();
};

// Call this every 10-20 seconds during active trip
setInterval(async () => {
  const position = await getCurrentPosition();
  await updateLocation(position);
}, 15000); // Every 15 seconds
```

---

## Full Location Tracking Example

### Frontend Implementation

```typescript
// services/locationService.ts
import * as Location from 'expo-location';
import { Battery } from 'expo-battery';
import { api } from './api';

let trackingInterval: NodeJS.Timer | null = null;

// Start tracking location
export const startLocationTracking = async () => {
  // Request permissions
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  // Start interval to send location every 15 seconds
  trackingInterval = setInterval(async () => {
    try {
      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      // Get battery level
      const batteryLevel = await Battery.getBatteryLevelAsync();

      // Update location on backend
      await api.post('/location/current', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        altitude: location.coords.altitude || 0,
        batteryLevel: Math.round(batteryLevel * 100)
      });

      console.log('Location updated successfully');
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, 15000); // Every 15 seconds
};

// Stop tracking
export const stopLocationTracking = () => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
    console.log('Location tracking stopped');
  }
};

// Get current location (one-time)
export const fetchCurrentLocation = async () => {
  const response = await api.get('/location/current');
  return response.data;
};
```

### Usage in Trip Component

```typescript
// app/(tabs)/trips.tsx
import { startLocationTracking, stopLocationTracking } from '../../src/services/locationService';
import { tripApi } from '../../src/services/api';

const handleStartTrip = async () => {
  try {
    // Start the trip
    const trip = await tripApi.startTrip({
      id: generateId(),
      userId: user.id,
      sourceAddress,
      destinationAddress,
      // ... other fields
    });

    // Start location tracking
    await startLocationTracking();
    
    console.log('Trip started and tracking enabled');
  } catch (error) {
    console.error('Error starting trip:', error);
  }
};

const handleCompleteTrip = async () => {
  try {
    // Stop location tracking first
    stopLocationTracking();
    
    // Complete the trip
    await tripApi.completeTrip(tripId);
    
    console.log('Trip completed and tracking stopped');
  } catch (error) {
    console.error('Error completing trip:', error);
  }
};
```

---

## Comparison with Existing Endpoints

### Old Way (Manual Trip ID)
```typescript
// Need to track tripId manually
await api.post('/location/track', {
  tripId: 'trip_123',  // Must provide
  userId: 'user_123',  // Must provide
  latitude: 37.7749,
  longitude: -122.4194,
  // ... other fields
});
```

### New Way (Automatic)
```typescript
// Automatically uses authenticated user and finds active trip
await api.post('/location/current', {
  latitude: 37.7749,
  longitude: -122.4194,
  // ... other fields
  // No tripId or userId needed!
});
```

---

## Benefits

✅ **Simpler Frontend Code**
- No need to manage tripId manually
- Automatically uses authenticated user
- Less parameters to pass

✅ **Better User Experience**
- Automatic trip detection
- Clear error messages
- Includes trip info in response

✅ **Consistent with Auth Pattern**
- Uses JWT token like other endpoints
- Leverages existing auth middleware
- Follows RESTful conventions

---

## All Location Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| **GET** | `/api/location/current` | Get your current location | ✅ |
| **POST** | `/api/location/current` | Update your current location | ✅ |
| POST | `/api/location/track` | Track location (with tripId) | ✅ |
| POST | `/api/location/sos` | Send SOS alert | ✅ |
| POST | `/api/location/start-tracking` | Start trip tracking | ✅ |
| POST | `/api/location/stop-tracking` | Stop trip tracking | ✅ |
| GET | `/api/location/trip/:tripId` | Get trip location history | ✅ |
| GET | `/api/location/user/:userId/latest` | Get user's latest location | ✅ |
| GET | `/api/location/stats` | Get tracking statistics | ✅ |
| POST | `/api/location/share` | Share location with circle | ✅ |

---

## Testing with Postman/cURL

### Get Current Location
```bash
curl -X GET http://localhost:5000/api/location/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Current Location
```bash
curl -X POST http://localhost:5000/api/location/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "speed": 5.5,
    "heading": 180,
    "accuracy": 10,
    "batteryLevel": 85
  }'
```

---

## Notes

- **Active Trip Required**: The `/current` POST endpoint requires an active trip. Make sure to start a trip first using `/api/trips/start`
- **Authentication**: All endpoints require a valid JWT token in the Authorization header
- **Automatic WhatsApp**: Location updates trigger WhatsApp notifications every 5 minutes (when Twilio is configured)
- **Database Storage**: Every location update is saved to the database for trip history
- **Movement Detection**: The system automatically determines if the user is moving based on speed (> 0.5 m/s)

---

## Next Steps

1. **Update your frontend** to use the new `/current` endpoints
2. **Simplify location tracking** code by removing manual tripId management
3. **Test the endpoints** with your authentication token
4. **Monitor tracking** using `/api/location/stats`

The new endpoints make location tracking much simpler! 🎉
