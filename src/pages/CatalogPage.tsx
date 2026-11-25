import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { BookCover } from '../components/BookCover';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Book, Category } from '../types/library';
import { formatDate, getNameField, getStatusLabelColor } from '../utils/formatters';

export function CatalogPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState('');
  const [availability, setAvailability] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [reserving, setReserving] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: '60',
        search,
        categoryId,
        availability,
        sortBy,
      });
      const [booksRes, catRes] = await Promise.all([
        apiFetch<{ books: Book[] }>(`/api/books?${qs.toString()}`),
        apiFetch<{ categories: Category[] }>('/api/taxonomy/categories'),
      ]);
      setBooks(booksRes.books);
      setCategories(catRes.categories);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load catalog.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog();
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, availability, sortBy]);

  const handleReserve = async (book: Book) => {
    if (user?.role !== 'MEMBER') {
      navigate(`/reservations?bookId=${book._id}`);
      return;
    }
    setReserving(true);
    try {
      await apiFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({ bookId: book._id }),
      });
      pushToast(`Reservation placed for "${book.title}".`, 'success');
      setSelectedBook(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Reservation failed.', 'error');
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Book Catalog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Explore collection titles, shelf locations, and live copy availability
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, ISBN, author, publisher..."
            aria-label="Search catalog"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
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
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          aria-label="Filter by availability"
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All Availability</option>
          <option value="available">Available on Shelf</option>
          <option value="issued">Has Issued Copies</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort catalog"
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="newest">Sort: Newest Added</option>
          <option value="title_asc">Sort: Title (A-Z)</option>
          <option value="popular">Sort: Most Borrowed</option>
        </select>
      </div>

      {loading ? (
        <DataTableSkeleton rows={6} cols={5} />
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No books matched your current search and filter criteria.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {books.map((book) => {
            const statusMeta = getStatusLabelColor(book.status);
            return (
              <motion.div
                key={book._id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-4"
              >
                <div className="flex gap-3.5">
                  <BookCover
                    src={book.coverImageUrl}
                    title={book.title}
                    className="w-20 h-28"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                      {book.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {getNameField(book.authorId)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {getNameField(book.categoryId)} · Shelf {book.shelfNumber}
                    </p>
                    <div
                      className={`text-[11px] font-medium pt-1 whitespace-nowrap truncate tabular-nums ${statusMeta.className}`}
                    >
                      {statusMeta.label} · {book.availableCopies}/{book.totalCopies} avail
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 truncate">
                    {book.isbn}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBook(book)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          {books.map((book) => {
            const statusMeta = getStatusLabelColor(book.status);
            return (
              <div
                key={book._id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <BookCover src={book.coverImageUrl} title={book.title} className="w-12 h-16" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {book.title}
                    </h2>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {getNameField(book.authorId)} · {getNameField(book.categoryId)} ·{' '}
                      {getNameField(book.publisherId)} · Shelf {book.shelfNumber}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      ISBN {book.isbn} · {book.bookCode}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className={`text-xs font-medium ${statusMeta.className} font-mono`}>
                    {book.availableCopies}/{book.totalCopies} avail
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBook(book)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book Details Modal */}
      <Modal
        open={Boolean(selectedBook)}
        onClose={() => setSelectedBook(null)}
        title={selectedBook?.title || 'Book Details'}
        subtitle={selectedBook ? `${selectedBook.bookCode} · ISBN ${selectedBook.isbn}` : undefined}
        maxWidth="max-w-2xl"
      >
        {selectedBook && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-5">
              <BookCover
                src={selectedBook.coverImageUrl}
                title={selectedBook.title}
                className="w-32 h-44 mx-auto sm:mx-0"
              />
              <div className="flex-1 space-y-2.5 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">Author</span>
                    <span className="font-medium">{getNameField(selectedBook.authorId)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Publisher</span>
                    <span className="font-medium">{getNameField(selectedBook.publisherId)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Category</span>
                    <span className="font-medium">{getNameField(selectedBook.categoryId)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Shelf Location</span>
                    <span className="font-mono font-medium">{selectedBook.shelfNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Published</span>
                    <span className="font-mono">{formatDate(selectedBook.publicationDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Availability</span>
                    <span className="font-mono font-semibold">
                      {selectedBook.availableCopies} / {selectedBook.totalCopies} copies
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
                  {selectedBook.description || 'No synopsis recorded for this title.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {selectedBook.availableCopies === 0 ? (
                <button
                  type="button"
                  disabled={reserving}
                  onClick={() => handleReserve(selectedBook)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                >
                  {reserving ? 'Placing Reservation...' : 'Reserve Unavailable Book'}
                </button>
              ) : user?.role !== 'MEMBER' ? (
                <button
                  type="button"
                  onClick={() => navigate(`/issue-books?bookId=${selectedBook._id}`)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Issue Copy to Member
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
