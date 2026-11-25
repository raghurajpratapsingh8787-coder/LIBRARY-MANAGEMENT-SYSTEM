import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import { formatDateTime } from '../utils/formatters';

interface SessionItem {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { pushToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadSessions = () => {
    apiFetch<{ sessions: SessionItem[] }>('/api/auth/sessions')
      .then((res) => setSessions(res.sessions))
      .catch(() => {});
  };

  useEffect(() => {
    setName(user?.name || '');
    loadSessions();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      pushToast('Profile updated.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await apiFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      pushToast('Session revoked.', 'success');
      loadSessions();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to revoke session.', 'error');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Profile & Security</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your account credentials and active refresh sessions
        </p>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email / Role</label>
            <div className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 font-mono">
              {user?.email} · {user?.role}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Current Password (to change password)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">New Password (min 8 chars)</label>
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? 'Saving...' : 'Update Profile'}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Active Sessions</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {sessions.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {s.userAgent || 'Browser Session'} {s.isCurrent ? '(Current)' : ''}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Started {formatDateTime(s.createdAt)} · Expires {formatDateTime(s.expiresAt)}
                </div>
              </div>
              {!s.isCurrent && (
                <button
                  type="button"
                  onClick={() => handleRevokeSession(s.id)}
                  className="text-red-600 dark:text-red-400 hover:underline shrink-0"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
