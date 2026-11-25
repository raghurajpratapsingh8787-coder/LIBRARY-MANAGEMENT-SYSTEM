import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Fine, IssueTransaction, Member } from '../types/library';
import { formatCurrency, formatDate, getStatusLabelColor } from '../utils/formatters';

export function MembersPage() {
  const { pushToast } = useToast();
  const [searchParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [profileData, setProfileData] = useState<{
    member: Member;
    borrowingHistory: IssueTransaction[];
    pendingReturns: IssueTransaction[];
    fines: Fine[];
  } | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [membershipType, setMembershipType] = useState<'STUDENT' | 'FACULTY' | 'STAFF' | 'GENERAL'>('STUDENT');
  const [membershipExpiryDate, setMembershipExpiryDate] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'EXPIRED'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search,
        status: statusFilter,
        membershipType: typeFilter,
      });
      const res = await apiFetch<{ members: Member[] }>(`/api/members?${qs.toString()}`);
      setMembers(res.members);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load members.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadMembers, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, typeFilter]);

  const openCreate = () => {
    setEditingMember(null);
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setAddress('');
    setMembershipType('STUDENT');
    setMembershipExpiryDate(
      new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    );
    setStatus('ACTIVE');
    setFormOpen(true);
  };

  const openEdit = (m: Member) => {
    setEditingMember(m);
    setFullName(m.fullName);
    setEmail(m.email);
    setPhoneNumber(m.phoneNumber);
    setAddress(m.address);
    setMembershipType(m.membershipType);
    setMembershipExpiryDate(new Date(m.membershipExpiryDate).toISOString().slice(0, 10));
    setStatus(m.status);
    setFormOpen(true);
  };

  const openProfile = async (id: string) => {
    try {
      const res = await apiFetch<{
        member: Member;
        borrowingHistory: IssueTransaction[];
        pendingReturns: IssueTransaction[];
        fines: Fine[];
      }>(`/api/members/${id}`);
      setProfileData(res);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load member profile.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        fullName,
        email,
        phoneNumber,
        address,
        membershipType,
        membershipExpiryDate,
        status,
      };
      if (editingMember) {
        await apiFetch(`/api/members/${editingMember._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        pushToast('Member record updated.', 'success');
      } else {
        await apiFetch('/api/members', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('New member registered.', 'success');
      }
      setFormOpen(false);
      loadMembers();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (m: Member) => {
    try {
      await apiFetch(`/api/members/${m._id}`, { method: 'DELETE' });
      pushToast(`Removed ${m.fullName}.`, 'success');
      loadMembers();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Library Members</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage patron profiles, borrowing quotas, membership validity, and fine balances
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Member
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, member code, email, phone..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by membership type"
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All Membership Types</option>
          <option value="STUDENT">Student</option>
          <option value="FACULTY">Faculty</option>
          <option value="STAFF">Staff</option>
          <option value="GENERAL">General Member</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by member status"
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {loading ? (
        <DataTableSkeleton rows={6} cols={6} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-3">Code</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3 text-right">Active Loans</th>
                <th className="py-3 px-3 text-right">Outstanding Fines</th>
                <th className="py-3 px-3">Expiry</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {members.map((m) => {
                const st = getStatusLabelColor(m.status);
                return (
                  <tr key={m._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {m.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {m.email} · {m.phoneNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono">{m.memberCode}</td>
                    <td className="py-3 px-3">{m.membershipType}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      {m.activeBorrowCount} / {m.maxBorrowLimit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatCurrency(m.outstandingFineBalance)}
                    </td>
                    <td className="py-3 px-3 font-mono">{formatDate(m.membershipExpiryDate)}</td>
                    <td className={`py-3 px-3 font-medium ${st.className}`}>{st.label}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openProfile(m._id)}
                          aria-label={`View profile for ${m.fullName}`}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          aria-label={`Edit ${m.fullName}`}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          aria-label={`Delete ${m.fullName}`}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingMember ? 'Edit Member' : 'Register Library Member'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Membership Type</label>
              <select
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value as typeof membershipType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
                <option value="STAFF">Staff</option>
                <option value="GENERAL">General Member</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Membership Expiry</label>
              <input
                type="date"
                required
                value={membershipExpiryDate}
                onChange={(e) => setMembershipExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            {editingMember && (
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Saving...' : 'Save Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Member Profile Detail Modal */}
      <Modal
        open={Boolean(profileData)}
        onClose={() => setProfileData(null)}
        title={profileData?.member.fullName || 'Member Profile'}
        subtitle={
          profileData
            ? `${profileData.member.memberCode} · ${profileData.member.membershipType} · ${profileData.member.email}`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {profileData && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-slate-400">Active Loans</div>
                <div className="text-base font-mono font-bold mt-0.5">
                  {profileData.pendingReturns.length} / {profileData.member.maxBorrowLimit}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Outstanding Fines</div>
                <div className="text-base font-mono font-bold mt-0.5">
                  {formatCurrency(profileData.member.outstandingFineBalance)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Total History</div>
                <div className="text-base font-mono font-bold mt-0.5">
                  {profileData.borrowingHistory.length} loans
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Pending Returns</h3>
              {profileData.pendingReturns.length === 0 ? (
                <p className="text-slate-500">No pending returns.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {profileData.pendingReturns.map((loan) => (
                    <div key={loan._id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <div className="font-medium">{loan.bookId?.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {loan.bookCopyId?.accessionNumber} · Issued {formatDate(loan.issueDate)}
                        </div>
                      </div>
                      <span className="font-mono text-amber-700 dark:text-amber-400">
                        Due {formatDate(loan.dueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Recent Borrowing History</h3>
              {profileData.borrowingHistory.length === 0 ? (
                <p className="text-slate-500">No borrowing history yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto">
                  {profileData.borrowingHistory.map((h) => (
                    <div key={h._id} className="flex items-center justify-between px-3 py-2">
                      <span>{h.bookId?.title}</span>
                      <span className="font-mono text-slate-500">
                        {h.status} · {formatDate(h.issueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
