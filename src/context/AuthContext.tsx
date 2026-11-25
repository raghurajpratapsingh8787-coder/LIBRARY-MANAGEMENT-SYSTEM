import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, getAccessToken, setAccessToken } from '../services/api';
import type { AuthUser, NotificationItem } from '../types/library';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  needsBootstrap: boolean;
  allowMemberSelfRegistration: boolean;
  libraryName: string;
  adminContactName: string;
  adminContactEmail: string;
  notifications: NotificationItem[];
  unreadCount: number;
  login: (email: string, password: string) => Promise<void>;
  bootstrap: (payload: {
    name: string;
    email: string;
    password: string;
    seedSampleData: boolean;
    demoStaffPassword?: string;
  }) => Promise<void>;
  registerMember: (payload: {
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
    address: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [allowMemberSelfRegistration, setAllowMemberSelfRegistration] = useState(true);
  const [libraryName, setLibraryName] = useState('Library Management System');
  const [adminContactName, setAdminContactName] = useState('Raghuraj Pratap Singh');
  const [adminContactEmail, setAdminContactEmail] = useState('raghurajpratapsingh8787@gmail.com');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(data.notifications);
    } catch {
      // Ignore transient errors
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const status = await apiFetch<{
      needsBootstrap: boolean;
      allowMemberSelfRegistration: boolean;
      libraryName: string;
      adminContactName?: string;
      adminContactEmail?: string;
      hasSessionCookie?: boolean;
    }>('/api/auth/status');
    setNeedsBootstrap(status.needsBootstrap);
    setAllowMemberSelfRegistration(status.allowMemberSelfRegistration);
    setLibraryName(status.libraryName || 'Library Management System');
    if (status.adminContactName) setAdminContactName(status.adminContactName);
    if (status.adminContactEmail) setAdminContactEmail(status.adminContactEmail);
    return status;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const status = await refreshStatus();
        if (status.hasSessionCookie && !status.needsBootstrap) {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          });
          if (res.ok && !cancelled) {
            const data = await res.json();
            setAccessToken(data.accessToken);
            setUser(data.user);
          }
        }
      } catch {
        // Not signed in yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    refreshNotifications();

    const token = getAccessToken();
    if (!token) return;

    const socket: Socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (item: NotificationItem) => {
      setNotifications((prev) => [item, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, refreshNotifications]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const bootstrap = async (payload: {
    name: string;
    email: string;
    password: string;
    seedSampleData: boolean;
    demoStaffPassword?: string;
  }) => {
    const data = await apiFetch<{ accessToken: string; user: AuthUser }>('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setNeedsBootstrap(false);
  };

  const registerMember = async (payload: {
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
    address: string;
  }) => {
    const data = await apiFetch<{ accessToken: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const me = await apiFetch<AuthUser>('/api/auth/me');
    setUser(me);
    await refreshStatus();
  };

  const markNotificationRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
  };

  const markAllNotificationsRead = async () => {
    await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsBootstrap,
        allowMemberSelfRegistration,
        libraryName,
        adminContactName,
        adminContactEmail,
        notifications,
        unreadCount,
        login,
        bootstrap,
        registerMember,
        logout,
        refreshUser,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
