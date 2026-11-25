import React, { useEffect, useState } from 'react';
import { Plus, Shield } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { AuditLogItem, LibrarySettings, UserRole } from '../types/library';
import { formatDateTime } from '../utils/formatters';

interface StaffUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export function SettingsPage() {
  const { refreshUser } = useAuth();
  const { pushToast } = useToast();

  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('LIBRARIAN');

  const loadAll = async () => {
    try {
      const [sRes, uRes, aRes] = await Promise.all([
        apiFetch<{ settings: LibrarySettings }>('/api/settings'),
        apiFetch<{ users: StaffUser[] }>('/api/auth/users'),
        apiFetch<{ logs: AuditLogItem[] }>('/api/settings/audit-logs'),
      ]);
      setSettings(sRes.settings);
      setUsers(uRes.users);
      setAuditLogs(aRes.logs);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load settings.', 'error');
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      await refreshUser();
      pushToast('Library policies saved.', 'success');
      loadAll();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      pushToast('Staff/user account created.', 'success');
      setUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      loadAll();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to create user.', 'error');
    }
  };

  const handleToggleUser = async (id: string) => {
    try {
      await apiFetch(`/api/auth/users/${id}/toggle`, { method: 'PATCH' });
      pushToast('User account status updated.', 'success');
      loadAll();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  if (!settings) {
    return <div className="text-sm text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Library Settings & Administration</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Configure fine rates, grace periods, borrowing limits, staff accounts, and security audit logs
        </p>
      </div>

      {/* Policy Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
      >
        <h2 className="text-sm font-semibold">Fine & Circulation Policies</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Library Display Name</label>
            <input
              type="text"
              required
              value={settings.libraryName}
              onChange={(e) => setSettings({ ...settings, libraryName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Daily Fine Rate ($)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={settings.dailyFineRate}
              onChange={(e) => setSettings({ ...settings, dailyFineRate: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Maximum Fine Cap ($)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={settings.maxFineAmount}
              onChange={(e) => setSettings({ ...settings, maxFineAmount: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Grace Period (Days)</label>
            <input
              type="number"
              min="0"
              value={settings.gracePeriodDays}
              onChange={(e) => setSettings({ ...settings, gracePeriodDays: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Default Loan Duration (Days)</label>
            <input
              type="number"
              min="1"
              value={settings.defaultLoanDays}
              onChange={(e) => setSettings({ ...settings, defaultLoanDays: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Max Unpaid Fine Before Block ($)</label>
            <input
              type="number"
              min="0"
              value={settings.maxAllowedFineBeforeBlock}
              onChange={(e) =>
                setSettings({ ...settings, maxAllowedFineBeforeBlock: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="pt-2">
          <div className="text-xs font-medium mb-2">Borrowing Limits by Membership Tier</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(['STUDENT', 'FACULTY', 'STAFF', 'GENERAL'] as const).map((tier) => (
              <div key={tier}>
                <label className="block text-slate-500 mb-1">{tier}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.borrowingLimits[tier]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      borrowingLimits: {
                        ...settings.borrowingLimits,
                        [tier]: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={settings.allowMemberSelfRegistration}
            onChange={(e) =>
              setSettings({ ...settings, allowMemberSelfRegistration: e.target.checked })
            }
          />
          Allow public Member self-registration (admin/librarian accounts remain invite-only)
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? 'Saving...' : 'Save Policy Settings'}
          </button>
        </div>
      </form>

      {/* Staff & Admin Accounts */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold">Administrators & Staff Accounts</h2>
          </div>
          <button
            type="button"
            onClick={() => setUserModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </button>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-3">Email</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u._id}>
                <td className="py-3 px-4 font-medium">{u.name}</td>
                <td className="py-3 px-3 font-mono">{u.email}</td>
                <td className="py-3 px-3">{u.role.replace('_', ' ')}</td>
                <td
                  className={`py-3 px-3 font-medium ${
                    u.isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'
                  }`}
                >
                  {u.isActive ? 'ACTIVE' : 'DISABLED'}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleUser(u._id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Trail */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Security & Circulation Audit Trail</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto text-xs">
          {auditLogs.map((log) => (
            <div key={log._id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {log.action}
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-300">· {log.details}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 shrink-0">
                {log.actorEmail} · {formatDateTime(log.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title="Create Staff / Admin User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email Address</label>
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="LIBRARIAN">Librarian</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="MEMBER">Member</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Initial Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
