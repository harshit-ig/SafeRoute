import { create } from 'zustand';
import { Trip, TripStatus, TripResponse, Alert, AlertType } from '../types';
import { tripApi, alertApi, locationApi } from '../services/api';
import { generateId } from '../utils/helpers';

interface TripState {
  activeTrip: Trip | null;
  tripHistory: Trip[];
  currentAlerts: Alert[];
  isLoading: boolean;
  error: string | null;
  trackingStats: {
    totalTrips: number;
    totalDistance: number;
    averageSpeed: number;
    lastUpdated: string | null;
  } | null;

  loadActiveTrip: (userId: string) => Promise<void>;
  loadTripHistory: (userId: string) => Promise<void>;
  loadTripById: (tripId: string) => Promise<Trip | null>;
  startTrip: (trip: Trip) => Promise<void>;
  endTrip: (tripId: string) => Promise<void>;
  cancelTrip: (tripId: string) => Promise<void>;
  sendSOS: (tripId: string, userId: string, lat: number, lng: number, description: string) => Promise<void>;
  sendSOSWithLocation: (userId: string, tripId: string | undefined, message?: string) => Promise<void>;
  cancelSOS: (alertId: string) => Promise<void>;
  loadTripAlerts: (tripId: string) => Promise<void>;
  loadTrackingStats: () => Promise<void>;
  getTripLocationHistory: (tripId: string, limit?: number) => Promise<any[]>;
  clearError: () => void;
}

function mapTripResponse(t: TripResponse): Trip {
  return {
    id: t.id,
    userId: t.userId,
    sourceLat: t.sourceLatitude,
    sourceLng: t.sourceLongitude,
    destinationLat: t.destinationLatitude,
    destinationLng: t.destinationLongitude,
    sourceAddress: t.sourceAddress,
    destinationAddress: t.destinationAddress,
    routePolyline: t.routePolyline || '',
    status: t.status as TripStatus,
    startTime: new Date(t.startTime).getTime(),
    endTime: t.endTime ? new Date(t.endTime).getTime() : undefined,
    deviationCount: t.deviationCount || 0,
    stopCount: t.stopCount || 0,
    alertCount: t.alertCount || 0,
    sharedWithUsers: [],
    locationUpdates: [],
  };
}

export const useTripStore = create<TripState>((set, get) => ({
  activeTrip: null,
  tripHistory: [],
  currentAlerts: [],
  isLoading: false,
  error: null,
  trackingStats: null,

  loadActiveTrip: async (userId: string) => {
    try {
      const response = await tripApi.getActiveTrip(userId);
      set({ activeTrip: mapTripResponse(response.data) });
    } catch {
      set({ activeTrip: null });
    }
  },

  loadTripHistory: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tripApi.getUserTrips(userId);
      const trips = response.data.map(mapTripResponse);
      set({ tripHistory: trips, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to load trips',
        isLoading: false,
      });
    }
  },

  loadTripById: async (tripId: string) => {
    try {
      const response = await tripApi.getTrip(tripId);
      return mapTripResponse(response.data);
    } catch {
      return null;
    }
  },

  startTrip: async (trip: Trip) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tripApi.startTrip({
        id: trip.id,
        userId: trip.userId,
        sourceLatitude: trip.sourceLat,
        sourceLongitude: trip.sourceLng,
        destinationLatitude: trip.destinationLat,
        destinationLongitude: trip.destinationLng,
        sourceAddress: trip.sourceAddress,
        destinationAddress: trip.destinationAddress,
        routePolyline: trip.routePolyline,
        startTime: new Date(trip.startTime).toISOString(),
      });
      
      const startedTrip = { ...trip, status: TripStatus.STARTED };
      set({ activeTrip: startedTrip, isLoading: false });
      
      // Auto-start location tracking on backend (async, don't wait)
      locationApi.startTracking(trip.id, trip.userId)
        .then(() => console.log('Location tracking started for trip:', trip.id))
        .catch((err) => console.error('Failed to start location tracking:', err));
        
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to start trip',
        isLoading: false,
      });
      throw err; // Re-throw to handle in UI
    }
  },

  endTrip: async (tripId: string) => {
    set({ isLoading: true });
    try {
      // Stop location tracking first
      try {
        await locationApi.stopTracking(tripId);
        console.log('Location tracking stopped for trip:', tripId);
      } catch (err) {
        console.error('Failed to stop location tracking:', err);
      }
      
      await tripApi.completeTrip(tripId, {
        endTime: new Date().toISOString(),
        status: 'COMPLETED',
      });
      set((state) => ({
        activeTrip: state.activeTrip?.id === tripId
          ? { ...state.activeTrip!, status: TripStatus.COMPLETED, endTime: Date.now() }
          : state.activeTrip,
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to end trip', isLoading: false });
    }
  },

  cancelTrip: async (tripId: string) => {
    try {
      await tripApi.cancelTrip(tripId);
      set((state) => ({
        activeTrip: state.activeTrip?.id === tripId ? null : state.activeTrip,
      }));
    } catch {}
  },

  sendSOS: async (tripId: string, userId: string, lat: number, lng: number, description: string) => {
    try {
      const alertId = generateId();
      await alertApi.createAlert({
        id: alertId,
        tripId,
        userId,
        type: AlertType.SOS,
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
        description,
      });
      
      // Also send via location API for WhatsApp integration
      try {
        await locationApi.sendSOS({
          userId,
          tripId,
          latitude: lat,
          longitude: lng,
          message: description,
        });
        console.log('SOS sent with location tracking integration');
      } catch (err) {
        console.error('Failed to send SOS via location API:', err);
      }
    } catch (err: any) {
      set({ error: 'Failed to send SOS alert' });
    }
  },

  sendSOSWithLocation: async (userId: string, tripId: string | undefined, message?: string) => {
    try {
      // Use location API which handles current location automatically
      await locationApi.sendSOS({
        userId,
        tripId,
        latitude: 0, // Backend will use current location
        longitude: 0,
        message: message || 'Emergency SOS - Help needed!',
      });
      console.log('SOS alert sent successfully');
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to send SOS alert' });
      throw err;
    }
  },

  cancelSOS: async (alertId: string) => {
    try {
      await alertApi.cancelAlert(alertId);
    } catch {}
  },

  loadTripAlerts: async (tripId: string) => {
    try {
      const response = await alertApi.getTripAlerts(tripId);
      const alerts: Alert[] = response.data.map((a) => ({
        id: a.id,
        tripId: a.tripId,
        userId: a.userId,
        type: a.type as AlertType,
        latitude: a.latitude,
        longitude: a.longitude,
        timestamp: new Date(a.timestamp).getTime(),
        description: a.description,
        isSent: a.isSent,
        isAcknowledged: false,
        isCancelled: false,
      }));
      set({ currentAlerts: alerts });
    } catch {}
  },

  loadTrackingStats: async () => {
    try {
      const response = await locationApi.getTrackingStats();
      set({ trackingStats: response.data });
    } catch (err) {
      console.error('Failed to load tracking stats:', err);
    }
  },

  getTripLocationHistory: async (tripId: string, limit?: number) => {
    try {
      const response = await locationApi.getTripLocationHistory(tripId, { limit });
      return response.data.locations || [];
    } catch (err) {
      console.error('Failed to load trip location history:', err);
      return [];
    }
  },

  clearError: () => set({ error: null }),
}));
