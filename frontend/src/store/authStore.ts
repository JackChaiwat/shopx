import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import api from "@/services/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithTokens: (access_token: string, refresh_token: string, user: User) => void;
  register: (email: string, password: string, full_name: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      initialize: async () => {
        const token = localStorage.getItem("access_token");
        if (!token) { set({ user: null, isAuthenticated: false }); return; }
        try {
          const res = await api.get("/auth/me");
          const user = res.data.data as User;
          localStorage.setItem("user", JSON.stringify(user));
          set({ user, isAuthenticated: true });
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          set({ user: null, isAuthenticated: false });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/login", { email, password });
          const { access_token, refresh_token, user } = res.data.data;
          localStorage.setItem("access_token", access_token);
          localStorage.setItem("refresh_token", refresh_token);
          localStorage.setItem("user", JSON.stringify(user));
          set({ user, isAuthenticated: true });
          return user as User;
        } finally {
          set({ isLoading: false });
        }
      },

      loginWithTokens: (access_token, refresh_token, user) => {
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        localStorage.setItem("user", JSON.stringify(user));
        set({ user, isAuthenticated: true });
      },

      register: async (email, password, full_name) => {
        set({ isLoading: true });
        try {
          await api.post("/auth/register", { email, password, full_name });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          try { await api.post("/auth/logout", { refresh_token: refreshToken }); }
          catch { /* swallow */ }
        }
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        set({ user: null, isAuthenticated: false });
      },

      setUser: (user) => {
        localStorage.setItem("user", JSON.stringify(user));
        set({ user, isAuthenticated: true });
      },
    }),
    {
      name: "auth-storage",
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);