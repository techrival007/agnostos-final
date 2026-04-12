import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import type { AppNotification } from "@/types";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  loading: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  loading: false,

  togglePanel: () => {
    const open = !get().isOpen;
    set({ isOpen: open });
    if (open) get().fetchNotifications();
  },

  closePanel: () => set({ isOpen: false }),

  fetchNotifications: async () => {
    try {
      set({ loading: true });
      const data = await apiFetch<AppNotification[]>("/api/notifications?limit=30");
      set({ notifications: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await apiFetch<{ count: number }>("/api/notifications/unread-count");
      set({ unreadCount: data.count });
    } catch {}
  },

  markAsRead: async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },
}));
