import { create } from 'zustand';
import { SafeCircle, User } from '../types';
import { groupApi, userApi } from '../services/api';
import { useAuthStore } from './authStore';
import { storage } from '../services/storage';

interface CircleState {
  circle: SafeCircle | null;
  members: User[];
  isLoading: boolean;
  error: string | null;
  joinError: string | null;

  loadUserCircle: () => Promise<void>;
  createCircle: (name: string, description?: string) => Promise<SafeCircle>;
  joinCircle: (groupCode: string) => Promise<void>;
  leaveCircle: (groupCode: string) => Promise<void>;
  loadMembers: (groupCode: string) => Promise<void>;
  clearError: () => void;
  clearJoinError: () => void;
}

export const useCircleStore = create<CircleState>((set, get) => ({
  circle: null,
  members: [],
  isLoading: false,
  error: null,
  joinError: null,

  loadUserCircle: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      if (!user?.groupCode) {
        set({ circle: null, members: [], isLoading: false });
        return;
      }
      const response = await groupApi.getGroup(user.groupCode);
      const data = response.data;
      const circle: SafeCircle = {
        id: data.groupCode,
        name: data.name,
        groupCode: data.groupCode,
        creatorId: data.creatorId,
        description: data.description,
        memberCount: data.members?.length || 0,
      };
      set({ circle, isLoading: false });
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Circle no longer exists, clear local
        const user = useAuthStore.getState().user;
        if (user) {
          const updated = { ...user, groupCode: undefined };
          useAuthStore.getState().setUser(updated);
          await storage.saveUser(updated);
        }
        set({ circle: null, members: [], isLoading: false });
      } else {
        set({ error: 'Failed to load circle', isLoading: false });
      }
    }
  },

  createCircle: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not logged in');
      if (user.groupCode) throw new Error('You are already in a Safe Circle');

      const response = await groupApi.createGroup({
        name,
        creatorId: user.id,
        description,
      });
      const data = response.data;
      const circle: SafeCircle = {
        id: data.groupCode,
        name: data.name,
        groupCode: data.groupCode,
        creatorId: data.creatorId,
        description: data.description,
        memberCount: 1,
      };

      // Update user's groupCode
      const updated = { ...user, groupCode: data.groupCode };
      useAuthStore.getState().setUser(updated);
      await storage.saveUser(updated);

      set({ circle, isLoading: false });
      return circle;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create circle';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  joinCircle: async (groupCode: string) => {
    set({ isLoading: true, joinError: null });
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not logged in');

      const response = await groupApi.joinGroup({ groupCode, userId: user.id });
      const data = response.data;
      const circle: SafeCircle = {
        id: data.groupCode,
        name: data.name,
        groupCode: data.groupCode,
        creatorId: data.creatorId,
        description: data.description,
        memberCount: data.members?.length || 0,
      };

      const updated = { ...user, groupCode: data.groupCode };
      useAuthStore.getState().setUser(updated);
      await storage.saveUser(updated);

      set({ circle, isLoading: false });
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Failed to join circle';
      if (msg.toLowerCase().includes('not found')) {
        msg = 'Circle not found. Please check the code and try again.';
      } else if (msg.toLowerCase().includes('already')) {
        msg = 'You are already a member of this circle.';
      }
      set({ joinError: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  leaveCircle: async (groupCode: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not logged in');

      await groupApi.leaveGroup({ groupCode, userId: user.id });

      const updated = { ...user, groupCode: undefined };
      useAuthStore.getState().setUser(updated);
      await storage.saveUser(updated);

      set({ circle: null, members: [], isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to leave circle',
        isLoading: false,
      });
    }
  },

  loadMembers: async (groupCode: string) => {
    set({ isLoading: true });
    try {
      const response = await groupApi.getMembers(groupCode);
      const data = response.data;
      const members: User[] = (data.members || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        phoneNumber: m.phone,
        email: m.email,
        groupCode: data.groupCode,
      }));
      set({
        members,
        isLoading: false,
        circle: get().circle
          ? { ...get().circle!, memberCount: members.length }
          : null,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
  clearJoinError: () => set({ joinError: null }),
}));
