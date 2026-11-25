import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

interface OverdueRecord {
  _id: string;
  transactionCode: string;
  bookId: { title: string; bookCode: string; shelfNumber: string };
  bookCopyId: { accessionNumber: string };
  memberId: { fullName: string; memberCode: string; email: string };
  issueDate: string;
  dueDate: string;
  overdueDays: number;
  accruedFine: number;
}

export function OverduePage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [overdue, setOverdue] = useState<OverdueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ overdue: OverdueRecord[] }>('/api/circulation/overdue')
      .then((res) => setOverdue(res.overdue))
      .catch((err) =>
        pushToast(err instanceof Error ? err.message : 'Failed to load overdue list.', 'error')
      )
      .finally(() => setLoading(false));
  }, [pushToast]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Overdue Books</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Loans past due date with accrued fine projections calculated by library policy
          </p>
        </div>
        {user?.role !== 'MEMBER' && (
          <Link
            to="/return-books"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
          >
            Process Returns
          </Link>
        )}
      </div>

      {loading ? (
        <DataTableSkeleton rows={5} cols={6} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Transaction</th>
                <th className="py-3 px-3">Book & Copy</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Days Overdue</th>
                <th className="py-3 px-4 text-right">Accrued Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {overdue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No overdue books at this time.
                  </td>
                </tr>
              ) : (
                overdue.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono">{item.transactionCode}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium">{item.bookId?.title}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {item.bookCopyId?.accessionNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div>{item.memberId?.fullName}</div>
                      <div className="text-[11px] text-slate-400">{item.memberId?.email}</div>
                    </td>
                    <td className="py-3 px-3 font-mono">{formatDate(item.dueDate)}</td>
                    <td className="py-3 px-3 text-right font-mono text-red-600 dark:text-red-400 font-semibold">
                      {item.overdueDays}d
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(item.accruedFine)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
