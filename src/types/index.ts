// ==================== User ====================
export interface User {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  password?: string;
  profilePicUrl?: string;
  profilePhoto?: string;
  groupCode?: string;
}

// ==================== Trip ====================
export enum TripStatus {
  PLANNED = 'PLANNED',
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DELAYED = 'DELAYED',
  EMERGENCY = 'EMERGENCY',
}

export interface Trip {
  id: string;
  userId: string;
  sourceLat: number;
  sourceLng: number;
  destinationLat: number;
  destinationLng: number;
  sourceAddress: string;
  destinationAddress: string;
  routePolyline: string;
  status: TripStatus;
  startTime: number;
  endTime?: number;
  deviationCount: number;
  stopCount: number;
  alertCount: number;
  routeId?: string;
  estimatedDuration?: number;
  estimatedDistance?: number;
  sharedWithUsers: string[];
  locationUpdates: Array<{ latitude: number; longitude: number; timestamp?: number }>;
  traveledPath?: Array<{ latitude: number; longitude: number }>; // Path user has traveled
  currentProgress?: number; // Progress percentage (0-100)
}

// ==================== Alert ====================
export enum AlertType {
  DEVIATION = 'DEVIATION',
  STOP = 'STOP',
  SOS = 'SOS',
  TRIP_COMPLETE = 'TRIP_COMPLETE',
  ROUTE_DEVIATION = 'ROUTE_DEVIATION',
  TRIP_OVERDUE = 'TRIP_OVERDUE',
  EMERGENCY = 'EMERGENCY',
  SAFETY_CHECK = 'SAFETY_CHECK',
  DESTINATION_REACHED = 'DESTINATION_REACHED',
  TRIP_STARTED = 'TRIP_STARTED',
}

export interface Alert {
  id: string;
  tripId: string;
  userId: string;
  type: AlertType;
  latitude: number;
  longitude: number;
  timestamp: number;
  description: string;
  isSent: boolean;
  isAcknowledged: boolean;
  isCancelled: boolean;
}

// ==================== Route ====================
export interface PathPoint {
  id: string;
  pathId: string;
  latitude: number;
  longitude: number;
  isSource: boolean;
  isDestination: boolean;
  isWaypoint: boolean;
  order: number;
}

export interface RoutePath {
  id: string;
  routeId: string;
  name: string;
  description: string;
  isActive: boolean;
  points: PathPoint[];
}

export interface SavedRoute {
  id: string;
  userId: string;
  name: string;
  description: string;
  sourceLat: number;
  sourceLng: number;
  destinationLat: number;
  destinationLng: number;
  sourceAddress: string;
  destinationAddress: string;
  isActive: boolean;
  createdAt: number;
  paths: RoutePath[];
}

// ==================== Safe Circle ====================
export interface SafeCircle {
  id: string;
  name: string;
  groupCode: string;
  creatorId: string;
  description?: string;
  memberCount: number;
}

export interface CircleMember {
  userId: string;
  groupCode: string;
  joinedAt: number;
}

// ==================== Place ====================
export interface Place {
  id: string;
  name: string;
  address: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// ==================== API Types ====================
export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  phone: string;
  email?: string;
  groupCode?: string;
  profilePhoto?: string;
  token?: string;
}

export interface TripResponse {
  id: string;
  userId: string;
  sourceLatitude: number;
  sourceLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  sourceAddress: string;
  destinationAddress: string;
  routePolyline?: string;
  status: string;
  startTime: string;
  endTime?: string;
  deviationCount?: number;
  stopCount?: number;
  alertCount?: number;
}

export interface AlertResponse {
  id: string;
  tripId: string;
  userId: string;
  type: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  description: string;
  isSent: boolean;
}

export interface GroupResponse {
  groupCode: string;
  name: string;
  description?: string;
  creatorId: string;
  members?: UserResponse[];
}

export interface StatusResponse {
  success: boolean;
  message: string;
}

// ==================== Alert Item (UI) ====================
export interface AlertItem {
  title: string;
  description: string;
  time: string;
  type: string;
}
