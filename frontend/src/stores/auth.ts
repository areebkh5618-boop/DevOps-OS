import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setTokens: (access, refresh) => {
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.login(email, password);
          get().setTokens(data.access_token, data.refresh_token);
          await get().fetchUser();
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (userData) => {
        set({ isLoading: true });
        try {
          await authApi.register(userData);
          await get().login(userData.email, userData.password);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      fetchUser: async () => {
        try {
          const { data } = await authApi.me();
          set({ user: data, isAuthenticated: true });
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: "devverse-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
