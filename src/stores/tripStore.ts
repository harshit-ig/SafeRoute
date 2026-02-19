import { create } from 'zustand';
import { Trip, TripStatus, TripResponse, Alert, AlertType } from '../types';
import { tripApi, alertApi } from '../services/api';
import { generateId } from '../utils/helpers';

interface LocationUpdateResult {
  progressIndex: number;
  isDeviated: boolean;
  isGoingBackward: boolean;
  hasJoinedRoute: boolean;
  distanceFromRoute: number;
  threshold: number;
  remainingDistance: number;
  etaSeconds: number;
  deviationCount: number;
  totalPoints: number;
  activeRouteIndex: number;
  tripCompleted?: boolean;
  distanceToDestination?: number;
}

interface TripState {
  activeTrip: Trip | null;
  tripHistory: Trip[];
  currentAlerts: Alert[];
  isLoading: boolean;
  error: string | null;

  loadActiveTrip: (userId: string) => Promise<void>;
  loadTripHistory: (userId: string) => Promise<void>;
  loadTripById: (tripId: string) => Promise<Trip | null>;
  startTrip: (trip: Trip) => Promise<void>;
  endTrip: (tripId: string) => Promise<void>;
  cancelTrip: (tripId: string) => Promise<void>;
  updateLocation: (tripId: string, latitude: number, longitude: number) => Promise<LocationUpdateResult | null>;
  sendSOS: (tripId: string, userId: string, lat: number, lng: number, description: string) => Promise<void>;
  cancelSOS: (alertId: string) => Promise<void>;
  loadTripAlerts: (tripId: string) => Promise<void>;
  clearError: () => void;
}

// Backend uses 'ACTIVE' but frontend enum uses 'STARTED'
function normalizeStatus(status: string): TripStatus {
  if (status === 'ACTIVE') return TripStatus.STARTED;
  return (status as TripStatus) || TripStatus.PLANNED;
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
    alternativePolylines: t.alternativePolylines || [],
    status: normalizeStatus(t.status),
    startTime: new Date(t.startTime).getTime(),
    endTime: t.endTime ? new Date(t.endTime).getTime() : undefined,
    deviationCount: t.deviationCount || 0,
    stopCount: t.stopCount || 0,
    alertCount: t.alertCount || 0,
    estimatedDuration: (t as any).estimatedDuration,
    estimatedDistance: (t as any).estimatedDistance,
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
      await tripApi.startTrip({
        id: trip.id,
        userId: trip.userId,
        sourceLatitude: trip.sourceLat,
        sourceLongitude: trip.sourceLng,
        destinationLatitude: trip.destinationLat,
        destinationLongitude: trip.destinationLng,
        sourceAddress: trip.sourceAddress,
        destinationAddress: trip.destinationAddress,
        routePolyline: trip.routePolyline,
        alternativePolylines: trip.alternativePolylines || [],
        startTime: new Date(trip.startTime).toISOString(),
      });
      set({ activeTrip: { ...trip, status: TripStatus.STARTED }, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to start trip';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  endTrip: async (tripId: string) => {
    set({ isLoading: true });
    try {
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

  updateLocation: async (tripId: string, latitude: number, longitude: number) => {
    try {
      const res = await tripApi.updateLocation(tripId, { latitude, longitude });
      return res.data as LocationUpdateResult;
    } catch {
      return null;
    }
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
    } catch (err: any) {
      set({ error: 'Failed to send SOS alert' });
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

  clearError: () => set({ error: null }),
}));
