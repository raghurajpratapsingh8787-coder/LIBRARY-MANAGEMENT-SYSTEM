import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { BookCover } from '../components/BookCover';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Book, BookCopy, Category } from '../types/library';
import { getNameField, getStatusLabelColor } from '../utils/formatters';

export function BooksPage() {
  const { pushToast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectBook, setInspectBook] = useState<{ book: Book; copies: BookCopy[] } | null>(null);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '12',
        search,
        categoryId,
        status: statusFilter,
        sortBy,
      });
      const [res, catRes] = await Promise.all([
        apiFetch<{ books: Book[]; pagination: { totalPages: number } }>(`/api/books?${qs.toString()}`),
        apiFetch<{ categories: Category[] }>('/api/taxonomy/categories'),
      ]);
      setBooks(res.books);
      setTotalPages(res.pagination.totalPages);
      setCategories(catRes.categories);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load books.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadBooks, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, categoryId, statusFilter, sortBy]);

  const handleDelete = async (book: Book) => {
    try {
      await apiFetch(`/api/books/${book._id}`, { method: 'DELETE' });
      pushToast(`Deleted "${book.title}".`, 'success');
      setSelectedIds((prev) => prev.filter((id) => id !== book._id));
      loadBooks();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const handleBulkAction = async (action: 'ARCHIVE' | 'DELETE') => {
    if (selectedIds.length === 0) return;
    try {
      await apiFetch('/api/books/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      pushToast(`Bulk ${action.toLowerCase()} completed for ${selectedIds.length} books.`, 'success');
      setSelectedIds([]);
      loadBooks();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Bulk action failed.', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await apiFetch<string>('/api/books/export/csv');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'books-directory.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast('Books directory CSV exported.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'CSV export failed.', 'error');
    }
  };

  const openCopyInspector = async (bookId: string) => {
    try {
      const data = await apiFetch<{ book: Book; copies: BookCopy[] }>(`/api/books/${bookId}`);
      setInspectBook(data);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load copies.', 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === books.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(books.map((b) => b._id));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Books Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage titles, ISBN records, shelf assignments, and physical accession copies
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <Link
            to="/books/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Book
          </Link>
        </div>
      </div>

      {/* Filters & Bulk bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search title, ISBN, book ID, author..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => {
              setPage(1);
              setCategoryId(e.target.value);
            }}
            aria-label="Filter category"
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            aria-label="Filter status"
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">Active Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort books"
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="newest">Newest</option>
            <option value="title_asc">Title A–Z</option>
            <option value="popular">Most Popular</option>
          </select>

          {selectedIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => handleBulkAction('ARCHIVE')}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-nowrap"
              >
                Archive ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('DELETE')}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-red-600 text-white whitespace-nowrap"
              >
                Delete ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <DataTableSkeleton rows={8} cols={7} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={books.length > 0 && selectedIds.length === books.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all books on page"
                  />
                </th>
                <th className="py-3 px-3">Book</th>
                <th className="py-3 px-3">Book ID / ISBN</th>
                <th className="py-3 px-3">Author</th>
                <th className="py-3 px-3">Category / Publisher</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-right">Available</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {books.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    No books found.
                  </td>
                </tr>
              ) : (
                books.map((book) => {
                  const st = getStatusLabelColor(book.status);
                  return (
                    <tr
                      key={book._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(book._id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((p) => [...p, book._id]);
                            else setSelectedIds((p) => p.filter((id) => id !== book._id));
                          }}
                          aria-label={`Select ${book.title}`}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <BookCover src={book.coverImageUrl} title={book.title} className="w-9 h-12" />
                          <div className="min-w-0 max-w-[220px]">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {book.title}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Shelf {book.shelfNumber} · {book.edition}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="text-slate-900 dark:text-slate-100">{book.bookCode}</div>
                        <div className="text-[11px] text-slate-400">{book.isbn}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {getNameField(book.authorId)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200">
                          {getNameField(book.categoryId)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {getNameField(book.publisherId)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {book.totalCopies}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                        {book.availableCopies}
                      </td>
                      <td className={`py-3 px-3 font-medium ${st.className}`}>{st.label}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openCopyInspector(book._id)}
                            aria-label={`Inspect copies of ${book.title}`}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/books/${book._id}/edit`}
                            aria-label={`Edit ${book.title}`}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(book)}
                            aria-label={`Delete ${book.title}`}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Physical Copy Inspector Modal */}
      <Modal
        open={Boolean(inspectBook)}
        onClose={() => setInspectBook(null)}
        title={inspectBook?.book.title || 'Book Copies'}
        subtitle={
          inspectBook
            ? `Physical accession inventory · ${inspectBook.copies.length} tracked copies`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {inspectBook && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {inspectBook.copies.map((copy) => {
              const copyState = getStatusLabelColor(copy.status);
              return (
                <div
                  key={copy._id}
                  className="flex items-center justify-between px-4 py-2.5 text-xs"
                >
                  <div>
                    <div className="font-mono font-medium">{copy.accessionNumber}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Barcode {copy.barcode} · Condition {copy.condition} · Rack {copy.rackLocation}
                    </div>
                  </div>
                  <span className={`font-medium ${copyState.className}`}>{copyState.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
