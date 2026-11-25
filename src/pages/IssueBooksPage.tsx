import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Book, BookCopy, IssueTransaction, Member } from '../types/library';
import { formatDate, getStatusLabelColor } from '../utils/formatters';

export function IssueBooksPage() {
  const { pushToast } = useToast();
  const [searchParams] = useSearchParams();

  const [members, setMembers] = useState<Member[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [recentIssues, setRecentIssues] = useState<IssueTransaction[]>([]);

  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState(searchParams.get('bookId') || '');
  const [bookCopyId, setBookCopyId] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const loadData = async () => {
    try {
      const [mRes, bRes, txRes] = await Promise.all([
        apiFetch<{ members: Member[] }>('/api/members'),
        apiFetch<{ books: Book[] }>('/api/books?availability=available&limit=100'),
        apiFetch<{ issues: IssueTransaction[] }>('/api/circulation/transactions?status=ISSUED'),
      ]);
      setMembers(mRes.members);
      setBooks(bRes.books);
      setRecentIssues(txRes.issues);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load circulation data.', 'error');
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bookId) {
      setCopies([]);
      setBookCopyId('');
      return;
    }
    apiFetch<{ copies: BookCopy[] }>(`/api/books/${bookId}`)
      .then((res) => {
        const avail = res.copies.filter((c) => c.status === 'AVAILABLE');
        setCopies(avail);
        setBookCopyId(avail[0]?._id || '');
      })
      .catch(() => setCopies([]));
  }, [bookId]);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        issueTransaction: { transactionCode: string; issueDate: string; dueDate: string };
        book: { title: string; isbn: string };
        copy: { accessionNumber: string };
        member: { fullName: string; memberCode: string };
      }>('/api/circulation/issue', {
        method: 'POST',
        body: JSON.stringify({ memberId, bookId, bookCopyId: bookCopyId || undefined, dueDate, notes }),
      });

      pushToast(`Issued "${res.book.title}" to ${res.member.fullName}.`, 'success');
      setReceipt({
        title: 'Book Issue Receipt',
        code: res.issueTransaction.transactionCode,
        filename: `issue-receipt-${res.issueTransaction.transactionCode}.pdf`,
        fields: [
          { label: 'Member', value: `${res.member.fullName} (${res.member.memberCode})` },
          { label: 'Book Title', value: res.book.title },
          { label: 'ISBN', value: res.book.isbn },
          { label: 'Copy Accession', value: res.copy.accessionNumber },
          { label: 'Issue Date', value: formatDate(res.issueTransaction.issueDate) },
          { label: 'Due Date', value: formatDate(res.issueTransaction.dueDate) },
        ],
      });
      setBookId('');
      setBookCopyId('');
      setNotes('');
      loadData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Issue failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMember = members.find((m) => m._id === memberId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Issue Books</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Check out specific physical copies with atomic inventory verification and receipt generation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleIssue}
          className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 self-start"
        >
          <h2 className="text-sm font-semibold">New Issue Transaction</h2>

          <div>
            <label htmlFor="issue-member" className="block text-xs font-medium mb-1">
              Select Member
            </label>
            <select
              id="issue-member"
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Choose patron...</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.fullName} ({m.memberCode}) · {m.activeBorrowCount}/{m.maxBorrowLimit} loans
                </option>
              ))}
            </select>
            {selectedMember && selectedMember.status !== 'ACTIVE' && (
              <p className="text-xs text-red-600 mt-1">
                Account status is {selectedMember.status}. Borrowing is restricted.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="issue-book" className="block text-xs font-medium mb-1">
              Select Available Book
            </label>
            <select
              id="issue-book"
              required
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Choose book...</option>
              {books.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.title} ({b.availableCopies} avail)
                </option>
              ))}
            </select>
          </div>

          {copies.length > 0 && (
            <div>
              <label htmlFor="issue-copy" className="block text-xs font-medium mb-1">
                Physical Copy (Accession #)
              </label>
              <select
                id="issue-copy"
                required
                value={bookCopyId}
                onChange={(e) => setBookCopyId(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {copies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.accessionNumber} · {c.condition} · Rack {c.rackLocation}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="issue-due" className="block text-xs font-medium mb-1">
              Due Date
            </label>
            <input
              id="issue-due"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="issue-notes" className="block text-xs font-medium mb-1">
              Desk Notes (Optional)
            </label>
            <input
              id="issue-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condition check or checkout remarks"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium"
          >
            {submitting ? 'Processing Issue...' : 'Confirm & Issue Book'}
          </button>
        </form>

        <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Active Issued Loans</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Transaction</th>
                <th className="py-3 px-3">Book / Copy</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {recentIssues.slice(0, 12).map((iss) => {
                const st = getStatusLabelColor(iss.status);
                return (
                  <tr key={iss._id}>
                    <td className="py-3 px-4 font-mono">{iss.transactionCode}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium truncate max-w-[200px]">{iss.bookId?.title}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {iss.bookCopyId?.accessionNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3">{iss.memberId?.fullName}</td>
                    <td className="py-3 px-3 font-mono">{formatDate(iss.dueDate)}</td>
                    <td className={`py-3 px-4 font-medium ${st.className}`}>{st.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
