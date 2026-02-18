import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

const KEYS = {
  USER_ID: 'user_id',
  USER_JSON: 'user_json',
  SESSION_TOKEN: 'session_token',
  IS_LOGGED_IN: 'is_logged_in',
  PENDING_SYNC_ROUTES: 'pending_sync_routes',
  LAST_SYNC_TIME: 'last_sync_time',
};

export const storage = {
  // ─── Session Token (Secure) ───
  async saveToken(token: string) {
    await SecureStore.setItemAsync(KEYS.SESSION_TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.SESSION_TOKEN);
  },

  async clearToken() {
    await SecureStore.deleteItemAsync(KEYS.SESSION_TOKEN);
  },

  // ─── User Data ───
  async saveUser(user: User, token?: string) {
    await AsyncStorage.setItem(KEYS.USER_JSON, JSON.stringify(user));
    await AsyncStorage.setItem(KEYS.USER_ID, user.id);
    await AsyncStorage.setItem(KEYS.IS_LOGGED_IN, 'true');
    if (token) {
      await SecureStore.setItemAsync(KEYS.SESSION_TOKEN, token);
    }
  },

  async getUser(): Promise<User | null> {
    try {
      const json = await AsyncStorage.getItem(KEYS.USER_JSON);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  async getUserId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.USER_ID);
  },

  async isLoggedIn(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.IS_LOGGED_IN);
    return val === 'true';
  },

  async clearUser() {
    await AsyncStorage.multiRemove([
      KEYS.USER_JSON,
      KEYS.USER_ID,
      KEYS.IS_LOGGED_IN,
    ]);
    await SecureStore.deleteItemAsync(KEYS.SESSION_TOKEN);
  },

  // ─── Route Sync ───
  async savePendingSyncRoutes(routeIds: string[]) {
    await AsyncStorage.setItem(KEYS.PENDING_SYNC_ROUTES, JSON.stringify(routeIds));
  },

  async getPendingSyncRoutes(): Promise<string[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.PENDING_SYNC_ROUTES);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  },

  async updateLastSyncTime() {
    await AsyncStorage.setItem(KEYS.LAST_SYNC_TIME, Date.now().toString());
  },

  // ─── Generic ───
  async set(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },

  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },

  async clearAll() {
    await AsyncStorage.clear();
    await SecureStore.deleteItemAsync(KEYS.SESSION_TOKEN);
  },
};
