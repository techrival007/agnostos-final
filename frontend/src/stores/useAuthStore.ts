"use client";
import { create } from "zustand";
import type { User } from "@/types";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY_TOKEN = "agnostos_token";
const STORAGE_KEY_USER = "agnostos_user";
const STORAGE_KEY_TS = "agnostos_user_ts";
const USER_CACHE_MS = 10 * 60 * 1000; // 10 minutes before background re-verify

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isCacheFresh(): boolean {
  const ts = localStorage.getItem(STORAGE_KEY_TS);
  if (!ts) return false;
  return Date.now() - Number(ts) < USER_CACHE_MS;
}

function persistUser(user: User) {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_TS, String(Date.now()));
}

function clearUserCache() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(STORAGE_KEY_TS);
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string) => Promise<User>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

const cachedUser = readCachedUser();
const cachedToken = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_TOKEN) : null;

export const useAuthStore = create<AuthState>((set) => ({
  user: cachedToken ? cachedUser : null,
  token: cachedToken,
  loading: cachedToken ? !cachedUser : false,

  login: async (email, password) => {
    const res = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(STORAGE_KEY_TOKEN, res.token);
    persistUser(res.user);
    set({ user: res.user, token: res.token, loading: false });
    return res.user;
  },

  register: async (email, password, name) => {
    const res = await apiFetch<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    localStorage.setItem(STORAGE_KEY_TOKEN, res.token);
    persistUser(res.user);
    set({ user: res.user, token: res.token, loading: false });
    return res.user;
  },

  logout: () => {
    clearUserCache();
    set({ user: null, token: null, loading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) {
      set({ loading: false });
      return;
    }

    const cached = readCachedUser();
    if (cached && isCacheFresh()) {
      set({ user: cached, token, loading: false });
      return;
    }

    if (cached) {
      set({ user: cached, token, loading: false });
    }

    try {
      const user = await apiFetch<User>("/api/auth/me");
      persistUser(user);
      set({ user, token, loading: false });
    } catch {
      clearUserCache();
      set({ user: null, token: null, loading: false });
    }
  },
}));
