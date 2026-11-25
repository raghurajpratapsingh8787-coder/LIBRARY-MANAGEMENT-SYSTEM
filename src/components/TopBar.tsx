import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../services/api';
import { formatDateTime } from '../utils/formatters';

const ROUTE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/catalog': 'Book Catalog',
  '/books': 'Books Directory',
  '/books/new': 'Add New Book',
  '/categories': 'Book Categories',
  '/authors': 'Authors',
  '/publishers': 'Publishers',
  '/members': 'Members',
  '/issue-books': 'Issue Books',
  '/return-books': 'Return Books',
  '/reservations': 'Reservations',
  '/overdue': 'Overdue Books',
  '/fines': 'Fine Management',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

interface SearchResultBook {
  _id: string;
  title: string;
  bookCode: string;
  isbn: string;
  availableCopies: number;
}

interface SearchResultMember {
  _id: string;
  fullName: string;
  memberCode: string;
  email: string;
}

export function TopBar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, notifications, unreadCount, markNotificationRead } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [results, setResults] = useState<{ books: SearchResultBook[]; members: SearchResultMember[] }>({
    books: [],
    members: [],
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const pageTitle =
    ROUTE_TITLES[pathname] ||
    (pathname.startsWith('/books/') ? 'Book Details' : 'Workspace');

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ books: [], members: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{
          books: SearchResultBook[];
          members: SearchResultMember[];
        }>(`/api/dashboard/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data);
        setSearchOpen(true);
      } catch {
        // Ignore search errors
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <header className="h-16 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
            Library
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
          <span className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
            {pageTitle}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global search */}
        <div ref={searchRef} className="relative hidden md:block w-64 lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setSearchOpen(true)}
            placeholder="Search books, ISBN, or members..."
            aria-label="Global library search"
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />

          {searchOpen && (results.books.length > 0 || results.members.length > 0) && (
            <div className="absolute right-0 mt-2 w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-2 max-h-80 overflow-y-auto">
              {results.books.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Books</div>
                  {results.books.map((b) => (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery('');
                        navigate(`/catalog?search=${encodeURIComponent(b.isbn)}`);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {b.title}
                      </span>
                      <span className="font-mono text-slate-500 shrink-0">{b.bookCode}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.members.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Members</div>
                  {results.members.map((m) => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery('');
                        navigate(`/members?search=${encodeURIComponent(m.memberCode)}`);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {m.fullName}
                      </span>
                      <span className="font-mono text-slate-500 shrink-0">{m.memberCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
          {todayFormatted}
        </span>

        {/* Theme switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification center */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((p) => !p)}
            aria-label={`Notifications (${unreadCount} unread)`}
            className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-mono flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Notifications
                </span>
                <Link
                  to="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => {
                        markNotificationRead(n._id);
                        setNotifOpen(false);
                        if (n.link) navigate(n.link);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {n.title}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {n.message}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Link */}
        <Link
          to="/profile"
          className="flex items-center gap-2.5 pl-2 pr-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="hidden sm:block text-left leading-tight">
            <div className="text-xs font-medium text-slate-900 dark:text-slate-100 max-w-[120px] truncate">
              {user?.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {user?.role.replace('_', ' ')}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
