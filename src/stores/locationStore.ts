import { create } from 'zustand';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  ready: boolean;
  permissionGranted: boolean;

  /** Call once at app startup (root layout). Requests permission + starts watching. */
  initialize: () => Promise<void>;
  /** Get current coords or null */
  getCoords: () => { latitude: number; longitude: number } | null;
}

let watchSubscription: Location.LocationSubscription | null = null;

export const useLocationStore = create<LocationState>((set, get) => ({
  latitude: null,
  longitude: null,
  ready: false,
  permissionGranted: false,

  initialize: async () => {
    // Avoid double-init
    if (get().ready) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ ready: true, permissionGranted: false });
        Alert.alert(
          'Location Required',
          'SafeRoute needs location access to show your position on the map.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      set({ permissionGranted: true });

      // 1. Fast path: last known position (instant, may be null)
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        set({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          ready: true,
        });
      }

      // 2. If no cached position, get a fresh one quickly
      if (!last) {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        set({
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
          ready: true,
        });
      }

      // 3. Background watch — keeps the store up-to-date
      if (watchSubscription) {
        watchSubscription.remove();
      }
      watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          set({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            ready: true,
          });
        }
      );

      // Request background permission on Android (non-blocking)
      if (Platform.OS === 'android') {
        Location.requestBackgroundPermissionsAsync().catch(() => {});
      }
    } catch {
      set({ ready: true });
    }
  },

  getCoords: () => {
    const { latitude, longitude } = get();
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }
    return null;
  },
}));
