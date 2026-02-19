import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { storage } from './storage';
import ENV from '../constants/config';
import {
  LoginRequest,
  RegisterRequest,
  UserResponse,
  TripResponse,
  AlertResponse,
  GroupResponse,
  StatusResponse,
} from '../types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: ENV.BACKEND_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const url = config.url || '';
  if (!url.includes('/login') && !url.includes('/register')) {
    const token = await storage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ==================== User API ====================
export const userApi = {
  register: (data: RegisterRequest) =>
    api.post<UserResponse>('/users/register', data),

  login: (data: LoginRequest) =>
    api.post<UserResponse>('/users/login', data),

  getMe: () =>
    api.get<UserResponse>('/users/me'),

  getUser: (userId: string) =>
    api.get<UserResponse>(`/users/${userId}`),

  updateProfile: (userId: string, data: { name: string; email?: string }) =>
    api.put<UserResponse>(`/users/${userId}`, data),

  updatePhoto: (userId: string, profilePhoto: string) =>
    api.put<UserResponse>(`/users/${userId}/photo`, { profilePhoto }),

  getPhoto: (userId: string) =>
    api.get<{ profilePhoto: string }>(`/users/${userId}/photo`),
};

// ==================== Trip API ====================
export const tripApi = {
  startTrip: (data: {
    id: string;
    userId: string;
    sourceLatitude: number;
    sourceLongitude: number;
    destinationLatitude: number;
    destinationLongitude: number;
    sourceAddress: string;
    destinationAddress: string;
    routePolyline: string;
    startTime: string;
  }) => api.post<TripResponse>('/trips/start', data),

  completeTrip: (tripId: string, data: { endTime: string; status: string }) =>
    api.post<TripResponse>(`/trips/${tripId}/complete`, data),

  cancelTrip: (tripId: string) =>
    api.post<TripResponse>(`/trips/${tripId}/cancel`),

  getUserTrips: (userId: string, limit?: number, status?: string) => {
    const params: Record<string, string> = {};
    if (limit) params.limit = String(limit);
    if (status) params.status = status;
    return api.get<TripResponse[]>(`/trips/user/${userId}`, { params });
  },

  getActiveTrip: (userId: string) =>
    api.get<TripResponse>(`/trips/user/${userId}/active`),

  getTrip: (tripId: string) =>
    api.get<TripResponse>(`/trips/${tripId}`),
};

// ==================== Alert API ====================
export const alertApi = {
  createAlert: (data: {
    id: string;
    tripId: string;
    userId: string;
    type: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    description: string;
  }) => api.post<AlertResponse>('/alerts', data),

  cancelAlert: (alertId: string) =>
    api.post<StatusResponse>(`/alerts/${alertId}/cancel`),

  acknowledgeAlert: (alertId: string) =>
    api.post<StatusResponse>(`/alerts/${alertId}/acknowledge`),

  getTripAlerts: (tripId: string) =>
    api.get<AlertResponse[]>(`/alerts/trip/${tripId}`),

  getUserAlerts: (userId: string, limit?: number) =>
    api.get<AlertResponse[]>(`/alerts/user/${userId}`, {
      params: limit ? { limit: String(limit) } : {},
    }),
};

// ==================== Group/Circle API ====================
export const groupApi = {
  createGroup: (data: { name: string; creatorId: string; description?: string }) =>
    api.post<GroupResponse>('/groups/create', data),

  joinGroup: (data: { groupCode: string; userId: string }) =>
    api.post<GroupResponse>('/groups/join', data),

  leaveGroup: (data: { groupCode: string; userId: string }) =>
    api.post<StatusResponse>('/groups/leave', data),

  getMembers: (groupCode: string) =>
    api.get<GroupResponse>(`/groups/${groupCode}/members`),

  getGroup: (groupCode: string) =>
    api.get<GroupResponse>(`/groups/${groupCode}`),
};

// ==================== Route API ====================
export const routeApi = {
  getUserRoutes: (userId: string) =>
    api.get(`/routes/user/${userId}`),

  syncRoutes: (userId: string, localRouteIds: string[]) =>
    api.post(`/routes/sync/${userId}`, { localRouteIds }),

  getRoute: (routeId: string) =>
    api.get(`/routes/${routeId}`),

  createRoute: (data: any) =>
    api.post('/routes', data),

  updateRoute: (routeId: string, data: any) =>
    api.put(`/routes/${routeId}`, data),

  deleteRoute: (routeId: string) =>
    api.delete(`/routes/${routeId}`),
};

// ==================== Location API ====================
export const locationApi = {
  // Current location endpoints (uses authenticated user)
  getCurrentLocation: () =>
    api.get('/location/current'),

  updateCurrentLocation: (data: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    altitude?: number;
    batteryLevel?: number;
  }) => api.post('/location/current', data),

  // Trip tracking
  trackLocation: (data: {
    tripId: string;
    userId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    altitude?: number;
    timestamp?: string;
    batteryLevel?: number;
    isMoving?: boolean;
  }) => api.post('/location/track', data),

  startTracking: (tripId: string, userId: string) =>
    api.post('/location/start-tracking', { tripId, userId }),

  stopTracking: (tripId: string) =>
    api.post('/location/stop-tracking', { tripId }),

  // Location history
  getTripLocationHistory: (tripId: string, params?: {
    limit?: number;
    startTime?: string;
    endTime?: string;
  }) => api.get(`/location/trip/${tripId}`, { params }),

  getLatestUserLocation: (userId: string) =>
    api.get(`/location/user/${userId}/latest`),

  // Emergency and sharing
  sendSOS: (data: {
    userId: string;
    tripId?: string;
    latitude: number;
    longitude: number;
    message?: string;
  }) => api.post('/location/sos', data),

  shareLiveLocation: (userId: string, tripId: string) =>
    api.post('/location/share', { userId, tripId }),

  // Statistics
  getTrackingStats: () =>
    api.get('/location/stats'),
};

export default api;
