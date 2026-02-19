import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { locationService, LocationData } from '../services/locationService';
import { LatLng } from 'react-native-maps';

interface LocationTrackingOptions {
  tripId: string;
  userId: string;
  enabled: boolean;
  updateInterval?: number; // milliseconds
  onLocationUpdate?: (location: LatLng) => void;
  onError?: (error: string) => void;
}

interface LocationTrackingResult {
  currentLocation: LatLng | null;
  traveledPath: LatLng[];
  isTracking: boolean;
  error: string | null;
  distanceTraveled: number;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  clearPath: () => void;
}

export function useLocationTracking({
  tripId,
  userId,
  enabled,
  updateInterval = 15000, // 15 seconds default
  onLocationUpdate,
  onError,
}: LocationTrackingOptions): LocationTrackingResult {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [traveledPath, setTraveledPath] = useState<LatLng[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastUpdateTime = useRef<number>(Date.now());

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const updateLocation = async (location: Location.LocationObject) => {
    const newLocation: LatLng = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setCurrentLocation(newLocation);

    // Add to traveled path if moved significantly (> 5 meters)
    if (traveledPath.length > 0) {
      const lastPoint = traveledPath[traveledPath.length - 1];
      const distance = calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        newLocation.latitude,
        newLocation.longitude
      );

      if (distance > 5) {
        setTraveledPath((prev) => [...prev, newLocation]);
        setDistanceTraveled((prev) => prev + distance);
      }
    } else {
      // First location
      setTraveledPath([newLocation]);
    }

    // Send to backend using locationService
    const now = Date.now();
    if (now - lastUpdateTime.current >= updateInterval) {
      try {
        await locationService.updateCurrentLocation();
        lastUpdateTime.current = now;
        onLocationUpdate?.(newLocation);
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || 'Failed to update location';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }
  };

  const startTracking = async () => {
    try {
      // Request permissions
      const hasPermission = await locationService.requestPermissions();
      if (!hasPermission) {
        const errorMsg = 'Location permission denied';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      setIsTracking(true);
      setError(null);

      // Start backend tracking using locationService
      await locationService.startTracking({
        tripId,
        userId,
        updateInterval,
      });

      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await updateLocation(initialLocation);

      // Set up periodic location updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: updateInterval,
          distanceInterval: 5, // Update if moved 5+ meters
        },
        updateLocation
      );

      console.log('Location tracking started');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to start tracking';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsTracking(false);
    }
  };

  const stopTracking = async () => {
    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      await locationService.stopTracking();
      setIsTracking(false);
      console.log('Location tracking stopped');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to stop tracking';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  };

  const clearPath = () => {
    setTraveledPath([]);
    setDistanceTraveled(0);
  };

  // Auto start/stop tracking based on enabled prop
  useEffect(() => {
    if (enabled && !isTracking) {
      startTracking();
    } else if (!enabled && isTracking) {
      stopTracking();
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  return {
    currentLocation,
    traveledPath,
    isTracking,
    error,
    distanceTraveled,
    startTracking,
    stopTracking,
    clearPath,
  };
}
