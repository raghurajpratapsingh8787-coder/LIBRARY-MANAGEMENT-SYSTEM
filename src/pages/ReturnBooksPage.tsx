import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { IssueTransaction } from '../types/library';
import { formatCurrency, formatDate, getStatusLabelColor } from '../utils/formatters';

export function ReturnBooksPage() {
  const { pushToast } = useToast();
  const [issues, setIssues] = useState<IssueTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<IssueTransaction | null>(null);
  const [conditionOnReturn, setConditionOnReturn] = useState<'NEW' | 'GOOD' | 'FAIR' | 'WORN' | 'DAMAGED'>('GOOD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const loadLoans = async () => {
    setLoading(true);
    try {
      const [issRes, ovRes] = await Promise.all([
        apiFetch<{ issues: IssueTransaction[] }>('/api/circulation/transactions?status=ISSUED'),
        apiFetch<{ issues: IssueTransaction[] }>('/api/circulation/transactions?status=OVERDUE'),
      ]);
      setIssues([...ovRes.issues, ...issRes.issues]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load issued loans.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = issues.filter((iss) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      iss.transactionCode.toLowerCase().includes(q) ||
      iss.bookId?.title.toLowerCase().includes(q) ||
      iss.bookCopyId?.accessionNumber.toLowerCase().includes(q) ||
      iss.memberId?.fullName.toLowerCase().includes(q) ||
      iss.memberId?.memberCode.toLowerCase().includes(q)
    );
  });

  const handleReturn = async () => {
    if (!selectedLoan) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        returnTransaction: {
          returnCode: string;
          returnDate: string;
          overdueDays: number;
          fineAmount: number;
        };
        book: { title: string };
        copy: { accessionNumber: string };
        member: { fullName: string; memberCode: string };
      }>('/api/circulation/return', {
        method: 'POST',
        body: JSON.stringify({
          issueTransactionId: selectedLoan._id,
          conditionOnReturn,
          notes,
        }),
      });

      pushToast(`Returned "${res.book.title}".`, 'success');
      setSelectedLoan(null);
      setNotes('');
      setReceipt({
        title: 'Book Return Receipt',
        code: res.returnTransaction.returnCode,
        filename: `return-receipt-${res.returnTransaction.returnCode}.pdf`,
        fields: [
          { label: 'Member', value: `${res.member.fullName} (${res.member.memberCode})` },
          { label: 'Book Title', value: res.book.title },
          { label: 'Copy Accession', value: res.copy.accessionNumber },
          { label: 'Return Date', value: formatDate(res.returnTransaction.returnDate) },
          { label: 'Overdue Days', value: `${res.returnTransaction.overdueDays} days` },
          { label: 'Fine Assessed', value: formatCurrency(res.returnTransaction.fineAmount) },
        ],
      });
      loadLoans();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Return failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Return Books</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Check in borrowed copies, calculate overdue fines automatically, and promote waitlisted holds
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transaction code, book, accession #, or member..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        />
      </div>

      {loading ? (
        <DataTableSkeleton rows={6} cols={6} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Transaction</th>
                <th className="py-3 px-3">Book & Physical Copy</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Est. Overdue Fine</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No active issued books matching search.
                  </td>
                </tr>
              ) : (
                filtered.map((loan) => {
                  const st = getStatusLabelColor(loan.status);
                  return (
                    <tr key={loan._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono">{loan.transactionCode}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium">{loan.bookId?.title}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {loan.bookCopyId?.accessionNumber}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div>{loan.memberId?.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {loan.memberId?.memberCode}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">{formatDate(loan.dueDate)}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {loan.estimatedFine ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            {formatCurrency(loan.estimatedFine)} ({loan.estimatedOverdueDays}d)
                          </span>
                        ) : (
                          '$0.00'
                        )}
                      </td>
                      <td className={`py-3 px-3 font-medium ${st.className}`}>{st.label}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLoan(loan)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Process Return
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selectedLoan)}
        onClose={() => setSelectedLoan(null)}
        title="Confirm Book Return"
        subtitle={
          selectedLoan
            ? `${selectedLoan.bookId?.title} (${selectedLoan.bookCopyId?.accessionNumber})`
            : undefined
        }
      >
        {selectedLoan && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Borrower</span>
                <span className="font-medium">{selectedLoan.memberId?.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date</span>
                <span className="font-mono">{formatDate(selectedLoan.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Backend Calculated Fine</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(selectedLoan.estimatedFine || 0)} ({selectedLoan.estimatedOverdueDays || 0} days late)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Physical Condition on Return</label>
              <select
                value={conditionOnReturn}
                onChange={(e) => setConditionOnReturn(e.target.value as typeof conditionOnReturn)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="NEW">New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="WORN">Worn</option>
                <option value="DAMAGED">Damaged (Remove from shelf)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Return Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedLoan(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleReturn}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {submitting ? 'Processing...' : 'Complete Return'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
