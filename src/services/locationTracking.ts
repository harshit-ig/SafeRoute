import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { calculateHaversineDistance } from '../utils/helpers';

const LOCATION_TASK_NAME = 'saferoute-location-tracking';

// Deviation threshold in meters
const DEVIATION_THRESHOLD = 200;
// Stop detection threshold in meters (if user hasn't moved)
const STOP_THRESHOLD = 30;
// Stop detection time in seconds
const STOP_TIME_THRESHOLD = 300; // 5 minutes

interface LocationCallback {
  onLocationUpdate?: (latitude: number, longitude: number) => void;
  onDeviation?: (distance: number) => void;
  onStopDetected?: () => void;
}

let callbacks: LocationCallback = {};
let lastLocations: { latitude: number; longitude: number; timestamp: number }[] = [];

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: any) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;

      // Track locations for stop detection
      lastLocations.push({ latitude, longitude, timestamp: Date.now() });
      if (lastLocations.length > 20) lastLocations.shift();

      // Notify callback
      callbacks.onLocationUpdate?.(latitude, longitude);

      // Stop detection
      checkStopDetection();
    }
  }
});

function checkStopDetection() {
  if (lastLocations.length < 5) return;
  const now = Date.now();
  const recentLocs = lastLocations.filter(
    (loc) => now - loc.timestamp < STOP_TIME_THRESHOLD * 1000
  );
  if (recentLocs.length < 3) return;

  const first = recentLocs[0];
  const allClose = recentLocs.every(
    (loc) =>
      calculateHaversineDistance(first.latitude, first.longitude, loc.latitude, loc.longitude) <
      STOP_THRESHOLD
  );

  if (allClose && now - recentLocs[0].timestamp > STOP_TIME_THRESHOLD * 1000) {
    callbacks.onStopDetected?.();
  }
}

export function checkRouteDeviation(
  currentLat: number,
  currentLng: number,
  routePoints: { latitude: number; longitude: number }[]
): number {
  if (routePoints.length === 0) return 0;

  let minDistance = Infinity;
  for (const point of routePoints) {
    const dist = calculateHaversineDistance(currentLat, currentLng, point.latitude, point.longitude);
    if (dist < minDistance) minDistance = dist;
  }

  if (minDistance > DEVIATION_THRESHOLD) {
    callbacks.onDeviation?.(minDistance);
  }

  return minDistance;
}

export async function startLocationTracking(cb: LocationCallback): Promise<boolean> {
  try {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground !== 'granted') return false;

    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    if (background !== 'granted') {
      console.warn('Background location not granted, using foreground only');
    }

    callbacks = cb;
    lastLocations = [];

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // every 10 seconds
      distanceInterval: 10, // or 10 meters
      foregroundService: {
        notificationTitle: 'SafeRoute',
        notificationBody: 'Tracking your trip for safety',
        notificationColor: '#6C63FF',
      },
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });

    return true;
  } catch (error) {
    console.error('Failed to start location tracking:', error);
    return false;
  }
}

export async function stopLocationTracking(): Promise<void> {
  try {
    const isTracking = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    callbacks = {};
    lastLocations = [];
  } catch (error) {
    console.error('Failed to stop location tracking:', error);
  }
}

export async function isTrackingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}
