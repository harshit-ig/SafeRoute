import { create } from 'zustand';
import { SavedRoute, RoutePath, PathPoint } from '../types';
import { routeApi } from '../services/api';
import { generateId } from '../utils/helpers';

interface RouteState {
  routes: SavedRoute[];
  currentRoute: SavedRoute | null;
  isLoading: boolean;
  error: string | null;

  loadRoutes: (userId: string) => Promise<void>;
  loadRouteById: (routeId: string) => Promise<SavedRoute | null>;
  createRoute: (route: SavedRoute) => Promise<void>;
  deleteRoute: (routeId: string) => Promise<void>;
  clearError: () => void;
  setCurrentRoute: (route: SavedRoute | null) => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  currentRoute: null,
  isLoading: false,
  error: null,

  loadRoutes: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await routeApi.getUserRoutes(userId);
      const routes: SavedRoute[] = (response.data || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        description: r.description || '',
        sourceLat: r.sourceLat,
        sourceLng: r.sourceLng,
        destinationLat: r.destinationLat,
        destinationLng: r.destinationLng,
        sourceAddress: r.sourceAddress || '',
        destinationAddress: r.destinationAddress || '',
        isActive: r.isActive ?? true,
        createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
        paths: (r.paths || []).map((p: any) => ({
          id: p.id,
          routeId: r.id,
          name: p.name || '',
          description: p.description || '',
          isActive: p.isActive ?? true,
          points: (p.points || []).map((pt: any) => ({
            id: pt.id || generateId(),
            pathId: p.id,
            latitude: pt.latitude,
            longitude: pt.longitude,
            isSource: pt.isSource ?? false,
            isDestination: pt.isDestination ?? false,
            isWaypoint: pt.isWaypoint ?? false,
            order: pt.order ?? 0,
          })),
        })),
      }));
      set({ routes, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to load routes',
        isLoading: false,
      });
    }
  },

  loadRouteById: async (routeId: string) => {
    try {
      const response = await routeApi.getRoute(routeId);
      const r = response.data;
      const route: SavedRoute = {
        id: r.id,
        userId: r.userId,
        name: r.name,
        description: r.description || '',
        sourceLat: r.sourceLat,
        sourceLng: r.sourceLng,
        destinationLat: r.destinationLat,
        destinationLng: r.destinationLng,
        sourceAddress: r.sourceAddress || '',
        destinationAddress: r.destinationAddress || '',
        isActive: r.isActive ?? true,
        createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
        paths: (r.paths || []).map((p: any) => ({
          id: p.id,
          routeId: r.id,
          name: p.name || '',
          description: p.description || '',
          isActive: p.isActive ?? true,
          points: (p.points || []).map((pt: any) => ({
            id: pt.id || generateId(),
            pathId: p.id,
            latitude: pt.latitude,
            longitude: pt.longitude,
            isSource: pt.isSource ?? false,
            isDestination: pt.isDestination ?? false,
            isWaypoint: pt.isWaypoint ?? false,
            order: pt.order ?? 0,
          })),
        })),
      };
      set({ currentRoute: route });
      return route;
    } catch {
      return null;
    }
  },

  createRoute: async (route: SavedRoute) => {
    set({ isLoading: true, error: null });
    try {
      await routeApi.createRoute({
        id: route.id,
        userId: route.userId,
        name: route.name,
        description: route.description,
        sourceLat: route.sourceLat,
        sourceLng: route.sourceLng,
        destinationLat: route.destinationLat,
        destinationLng: route.destinationLng,
        sourceAddress: route.sourceAddress,
        destinationAddress: route.destinationAddress,
        isActive: route.isActive,
        paths: route.paths.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          points: p.points.map((pt) => ({
            latitude: pt.latitude,
            longitude: pt.longitude,
            isSource: pt.isSource,
            isDestination: pt.isDestination,
            isWaypoint: pt.isWaypoint,
            order: pt.order,
          })),
        })),
      });
      set((state) => ({
        routes: [route, ...state.routes],
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to save route',
        isLoading: false,
      });
      throw err;
    }
  },

  deleteRoute: async (routeId: string) => {
    try {
      await routeApi.deleteRoute(routeId);
      set((state) => ({
        routes: state.routes.filter((r) => r.id !== routeId),
        currentRoute: state.currentRoute?.id === routeId ? null : state.currentRoute,
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to delete route' });
    }
  },

  clearError: () => set({ error: null }),
  setCurrentRoute: (route) => set({ currentRoute: route }),
}));
