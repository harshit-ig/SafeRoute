import { create } from 'zustand';
import { User, UserResponse } from '../types';
import { userApi } from '../services/api';
import { storage } from '../services/storage';
import { generateId } from '../utils/helpers';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string, email?: string) => Promise<void>;
  updateProfile: (name: string, email?: string) => Promise<void>;
  updateProfilePhoto: (base64: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

function mapResponseToUser(res: UserResponse): User {
  return {
    id: res.id,
    name: res.name,
    phoneNumber: res.phone,
    email: res.email,
    groupCode: res.groupCode,
    profilePhoto: res.profilePhoto,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    console.log('[AuthStore] Initializing...');
    try {
      const savedUser = await storage.getUser();
      console.log('[AuthStore] Saved user:', savedUser ? 'Found' : 'Not found');
      
      if (savedUser) {
        set({ user: savedUser, isInitialized: true });
        console.log('[AuthStore] User restored from storage');
        
        // Try refreshing from server
        try {
          const response = await userApi.getMe();
          const freshUser = mapResponseToUser(response.data);
          await storage.saveUser(freshUser);
          set({ user: freshUser });
          console.log('[AuthStore] User refreshed from server');
        } catch (err) {
          console.log('[AuthStore] Could not refresh user from server, keeping local user');
          // Keep local user
        }
      } else {
        set({ isInitialized: true });
        console.log('[AuthStore] No saved user, initialization complete');
      }
    } catch (err) {
      console.error('[AuthStore] Initialize error:', err);
      set({ isInitialized: true });
    }
  },

  login: async (phone: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await userApi.login({ phone, password });
      const data = response.data;
      const user = mapResponseToUser(data);
      await storage.saveUser(user, data.token);
      set({ user, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  register: async (name: string, phone: string, password: string, email?: string) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const response = await userApi.register({ id, name, phone, password, email });
      const data = response.data;
      const user = mapResponseToUser(data);
      await storage.saveUser(user, data.token);
      set({ user, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  updateProfile: async (name: string, email?: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = get().user;
      if (!user) throw new Error('Not logged in');
      const response = await userApi.updateProfile(user.id, { name, email });
      const updated = mapResponseToUser(response.data);
      await storage.saveUser(updated);
      set({ user: updated, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Update failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  updateProfilePhoto: async (base64: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = get().user;
      if (!user) throw new Error('Not logged in');
      await userApi.updatePhoto(user.id, base64);
      const updated = { ...user, profilePhoto: base64 };
      await storage.saveUser(updated);
      set({ user: updated, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Photo update failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  logout: async () => {
    await storage.clearUser();
    set({ user: null, error: null });
  },

  setUser: (user: User) => set({ user }),

  clearError: () => set({ error: null }),
}));
