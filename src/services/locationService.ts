import * as Location from 'expo-location';
import { locationApi } from './api';
import { LatLng } from 'react-native-maps';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationTrackingOptions {
  tripId?: string;
  userId?: string;
  enableBackgroundUpdates?: boolean;
  updateInterval?: number;
  distanceInterval?: number;
}

class LocationService {
  private static instance: LocationService;
  private subscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private currentTripId: string | null = null;
  private currentUserId: string | null = null;

  private constructor() {}

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request location permissions:', error);
      return false;
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
      };
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  /**
   * Update current location to backend (simplified endpoint)
   */
  async updateCurrentLocation(): Promise<void> {
    try {
      const location = await this.getCurrentLocation();
      if (!location) {
        throw new Error('Could not get current location');
      }

      await locationApi.updateCurrentLocation(location);
      console.log('Current location updated successfully');
    } catch (error) {
      console.error('Failed to update current location:', error);
      throw error;
    }
  }

  /**
   * Start continuous location tracking for a trip
   */
  async startTracking(options: LocationTrackingOptions): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      if (this.isTracking) {
        console.log('Tracking already active');
        return;
      }

      this.currentTripId = options.tripId || null;
      this.currentUserId = options.userId || null;

      // Start backend tracking session
      if (this.currentTripId && this.currentUserId) {
        await locationApi.startTracking(this.currentTripId, this.currentUserId);
      }

      // Set up location subscription
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: options.updateInterval || 15000, // 15 seconds
          distanceInterval: options.distanceInterval || 5, // 5 meters
        },
        async (location) => {
          await this.handleLocationUpdate(location);
        }
      );

      this.isTracking = true;
      console.log('Location tracking started');
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      throw error;
    }
  }

  /**
   * Handle location update
   */
  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    try {
      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
      };

      // Use simplified endpoint that auto-detects trip
      await locationApi.updateCurrentLocation(locationData);
      
      console.log('Location updated:', {
        lat: locationData.latitude.toFixed(6),
        lng: locationData.longitude.toFixed(6),
        speed: locationData.speed?.toFixed(2),
      });
    } catch (error) {
      console.error('Failed to handle location update:', error);
    }
  }

  /**
   * Stop location tracking
   */
  async stopTracking(): Promise<void> {
    try {
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      if (this.currentTripId) {
        await locationApi.stopTracking(this.currentTripId);
      }

      this.isTracking = false;
      this.currentTripId = null;
      this.currentUserId = null;

      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Failed to stop location tracking:', error);
      throw error;
    }
  }

  /**
   * Send SOS alert with current location
   */
  async sendSOS(userId: string, tripId?: string, message?: string): Promise<void> {
    try {
      await locationApi.sendSOS({
        userId,
        tripId,
        latitude: 0, // Backend uses current location
        longitude: 0,
        message: message || 'Emergency SOS - Help needed!',
      });
      console.log('SOS alert sent successfully');
    } catch (error) {
      console.error('Failed to send SOS:', error);
      throw error;
    }
  }

  /**
   * Get trip location history
   */
  async getTripLocationHistory(
    tripId: string,
    options?: { limit?: number; startTime?: string; endTime?: string }
  ): Promise<LatLng[]> {
    try {
      const response = await locationApi.getTripLocationHistory(tripId, options);
      const locations = response.data.locations || [];
      
      return locations.map((loc: any) => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));
    } catch (error) {
      console.error('Failed to get trip location history:', error);
      return [];
    }
  }

  /**
   * Get tracking statistics
   */
  async getTrackingStats(): Promise<any> {
    try {
      const response = await locationApi.getTrackingStats();
      return response.data;
    } catch (error) {
      console.error('Failed to get tracking stats:', error);
      return null;
    }
  }

  /**
   * Share live location
   */
  async shareLiveLocation(userId: string, tripId: string): Promise<void> {
    try {
      await locationApi.shareLiveLocation(userId, tripId);
      console.log('Live location shared successfully');
    } catch (error) {
      console.error('Failed to share live location:', error);
      throw error;
    }
  }

  /**
   * Check if tracking is active
   */
  isTrackingActive(): boolean {
    return this.isTracking;
  }

  /**
   * Get current trip ID
   */
  getCurrentTripId(): string | null {
    return this.currentTripId;
  }
}

export const locationService = LocationService.getInstance();
export default locationService;
