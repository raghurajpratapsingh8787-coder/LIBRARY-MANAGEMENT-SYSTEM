import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Fine, FinePayment } from '../types/library';
import { formatCurrency, formatDate, getStatusLabelColor } from '../utils/formatters';

export function FinesPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();

  const [fines, setFines] = useState<Fine[]>([]);
  const [payments, setPayments] = useState<FinePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [payTarget, setPayTarget] = useState<Fine | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD_DESK' | 'BANK_TRANSFER'>('CASH');
  const [payNotes, setPayNotes] = useState('');

  const [waiveTarget, setWaiveTarget] = useState<Fine | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const loadFines = async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiFetch<{ fines: Fine[]; payments: FinePayment[] }>(`/api/fines${qs}`);
      setFines(res.fines);
      setPayments(res.payments);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load fines.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openPay = (f: Fine) => {
    const remaining = Math.max(0, Number((f.amount - f.paidAmount).toFixed(2)));
    setPayTarget(f);
    setAmountPaid(String(remaining));
    setPaymentMethod('CASH');
    setPayNotes('');
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        payment: { receiptNumber: string; paymentDate: string; amountPaid: number; paymentMethod: string };
        fine: { fineCode: string };
        member: { fullName: string; memberCode: string };
      }>(`/api/fines/${payTarget._id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaid: Number(amountPaid),
          paymentMethod,
          notes: payNotes,
        }),
      });
      pushToast(`Payment recorded (${res.payment.receiptNumber}).`, 'success');
      setPayTarget(null);
      setReceipt({
        title: 'Fine Payment Receipt',
        code: res.payment.receiptNumber,
        filename: `fine-receipt-${res.payment.receiptNumber}.pdf`,
        fields: [
          { label: 'Member', value: `${res.member.fullName} (${res.member.memberCode})` },
          { label: 'Fine Reference', value: res.fine.fineCode },
          { label: 'Amount Paid', value: formatCurrency(res.payment.amountPaid) },
          { label: 'Payment Method', value: res.payment.paymentMethod.replace(/_/g, ' ') },
          { label: 'Date', value: formatDate(res.payment.paymentDate) },
        ],
      });
      loadFines();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Payment failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiveTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/fines/${waiveTarget._id}/waive`, {
        method: 'POST',
        body: JSON.stringify({ waiverReason }),
      });
      pushToast(`Fine ${waiveTarget.fineCode} waived.`, 'success');
      setWaiveTarget(null);
      setWaiverReason('');
      loadFines();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Waiver failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalOutstanding = fines
    .filter((f) => f.status === 'UNPAID' || f.status === 'PARTIALLY_PAID')
    .reduce((acc, f) => acc + (f.amount - f.paidAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Fine Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track overdue assessments, record desk settlements, and issue payment receipts
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Outstanding Balance</div>
            <div className="text-lg font-mono font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalOutstanding)}
            </div>
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <Link
              to="/settings"
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Fine Policy
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit text-xs font-medium">
        {['', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED'].map((st) => (
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
            {st ? st.replace('_', ' ') : 'All Fines'}
          </button>
        ))}
      </div>

      {loading ? (
        <DataTableSkeleton rows={5} cols={7} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Fine Code</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Book</th>
                <th className="py-3 px-3 text-right">Overdue</th>
                <th className="py-3 px-3 text-right">Assessed</th>
                <th className="py-3 px-3 text-right">Paid</th>
                <th className="py-3 px-3">Status</th>
                {user?.role !== 'MEMBER' && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {fines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No fine records found.
                  </td>
                </tr>
              ) : (
                fines.map((f) => {
                  const st = getStatusLabelColor(f.status);
                  const open = f.status === 'UNPAID' || f.status === 'PARTIALLY_PAID';
                  return (
                    <tr key={f._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono">{f.fineCode}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium">{f.memberId?.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {f.memberId?.memberCode}
                        </div>
                      </td>
                      <td className="py-3 px-3">{f.bookId?.title}</td>
                      <td className="py-3 px-3 text-right font-mono">{f.overdueDays}d</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        {formatCurrency(f.amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatCurrency(f.paidAmount)}
                      </td>
                      <td className={`py-3 px-3 font-medium ${st.className}`}>{st.label}</td>
                      {user?.role !== 'MEMBER' && (
                        <td className="py-3 px-4 text-right">
                          {open && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openPay(f)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
                              >
                                Record Payment
                              </button>
                              {user?.role === 'SUPER_ADMIN' && (
                                <button
                                  type="button"
                                  onClick={() => setWaiveTarget(f)}
                                  className="text-slate-600 dark:text-slate-300 hover:underline"
                                >
                                  Waive
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Ledger History */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Fine Payment Receipts</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
              <th className="py-3 px-4">Receipt #</th>
              <th className="py-3 px-3">Fine</th>
              <th className="py-3 px-3">Member</th>
              <th className="py-3 px-3">Method</th>
              <th className="py-3 px-3 text-right">Amount</th>
              <th className="py-3 px-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p._id}>
                  <td className="py-2.5 px-4 font-mono">{p.receiptNumber}</td>
                  <td className="py-2.5 px-3 font-mono">{p.fineId?.fineCode}</td>
                  <td className="py-2.5 px-3">{p.memberId?.fullName}</td>
                  <td className="py-2.5 px-3">{p.paymentMethod.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium">
                    {formatCurrency(p.amountPaid)}
                  </td>
                  <td className="py-2.5 px-4 font-mono">{formatDate(p.paymentDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title="Record Fine Payment"
        subtitle={payTarget ? `${payTarget.fineCode} · ${payTarget.memberId?.fullName}` : undefined}
      >
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Amount Paid ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="CASH">Cash (Circulation Desk)</option>
              <option value="CARD_DESK">Card Terminal (Desk)</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPayTarget(null)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Waive Fine Modal (Super Admin) */}
      <Modal
        open={Boolean(waiveTarget)}
        onClose={() => setWaiveTarget(null)}
        title="Waive Outstanding Fine"
        subtitle={waiveTarget ? `${waiveTarget.fineCode} · Super Admin Exemption` : undefined}
      >
        <form onSubmit={handleWaive} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Exemption Reason</label>
            <textarea
              rows={3}
              required
              minLength={3}
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="Document reason for audit log..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setWaiveTarget(null)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white"
            >
              Confirm Exemption
            </button>
          </div>
        </form>
      </Modal>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
