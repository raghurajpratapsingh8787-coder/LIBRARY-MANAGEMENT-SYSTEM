import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Book, Member, Reservation } from '../types/library';
import { formatDate, getStatusLabelColor } from '../utils/formatters';

export function ReservationsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams] = useSearchParams();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [unavailableBooks, setUnavailableBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(Boolean(searchParams.get('bookId')));
  const [bookId, setBookId] = useState(searchParams.get('bookId') || '');
  const [memberId, setMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const [resData, booksData] = await Promise.all([
        apiFetch<{ reservations: Reservation[] }>(`/api/reservations${qs}`),
        apiFetch<{ books: Book[] }>('/api/books?status=OUT_OF_STOCK&limit=100'),
      ]);
      setReservations(resData.reservations);
      setUnavailableBooks(booksData.books);

      if (user?.role !== 'MEMBER') {
        const mRes = await apiFetch<{ members: Member[] }>('/api/members?status=ACTIVE');
        setMembers(mRes.members);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load reservations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          bookId,
          ...(user?.role !== 'MEMBER' ? { memberId } : {}),
        }),
      });
      pushToast('Reservation added to waitlist queue.', 'success');
      setModalOpen(false);
      setBookId('');
      setMemberId('');
      loadData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to create reservation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'cancel' | 'fulfill') => {
    try {
      await apiFetch(`/api/reservations/${id}/${action}`, { method: 'PATCH' });
      pushToast(
        action === 'cancel' ? 'Reservation cancelled.' : 'Reservation marked fulfilled.',
        'success'
      );
      loadData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Reservations & Waitlist</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Queue holds for out-of-stock books with automatic availability notifications
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white self-start whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          New Reservation
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit text-xs font-medium">
        {['', 'PENDING', 'AVAILABLE', 'FULFILLED', 'CANCELLED', 'EXPIRED'].map((st) => (
          <button
            key={st || 'ALL'}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === st
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {st || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <DataTableSkeleton rows={5} cols={6} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Ref</th>
                <th className="py-3 px-3">Book Title</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3 text-right">Queue #</th>
                <th className="py-3 px-3">Reserved</th>
                <th className="py-3 px-3">Expires</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No reservations found.
                  </td>
                </tr>
              ) : (
                reservations.map((r) => {
                  const st = getStatusLabelColor(r.status);
                  const active = r.status === 'PENDING' || r.status === 'AVAILABLE';
                  return (
                    <tr key={r._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono">{r.reservationCode}</td>
                      <td className="py-3 px-3 font-medium">{r.bookId?.title}</td>
                      <td className="py-3 px-3">
                        <div>{r.memberId?.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {r.memberId?.memberCode}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">#{r.queuePosition}</td>
                      <td className="py-3 px-3 font-mono">{formatDate(r.reservationDate)}</td>
                      <td className="py-3 px-3 font-mono">{formatDate(r.expiryDate)}</td>
                      <td className={`py-3 px-3 font-medium ${st.className}`}>{st.label}</td>
                      <td className="py-3 px-4 text-right">
                        {active && (
                          <div className="inline-flex items-center gap-2">
                            {user?.role !== 'MEMBER' && (
                              <button
                                type="button"
                                onClick={() => handleAction(r._id, 'fulfill')}
                                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                Fulfill
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAction(r._id, 'cancel')}
                              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Reserve Unavailable Book">
        <form onSubmit={handleCreate} className="space-y-4">
          {unavailableBooks.length === 0 ? (
            <p className="text-xs text-slate-500">
              All catalog books currently have available copies on the shelf.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Unavailable Book</label>
                <select
                  required
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="">Select book...</option>
                  {unavailableBooks.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.title} ({b.bookCode})
                    </option>
                  ))}
                </select>
              </div>

              {user?.role !== 'MEMBER' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Member</label>
                  <select
                    required
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="">Select active member...</option>
                    {members.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.fullName} ({m.memberCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? 'Reserving...' : 'Place Reservation'}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
