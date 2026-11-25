import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { BookCover } from '../components/BookCover';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { fadeSlideUp, staggerContainer } from '../animations/motionPresets';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import type { AuditLogItem, Book, IssueTransaction, ReturnTransaction } from '../types/library';
import { formatCurrency, formatDate, formatDateTime, getNameField } from '../utils/formatters';

interface DashboardPayload {
  kpis: {
    totalBooks: number;
    totalTitles: number;
    availableBooks: number;
    issuedBooks: number;
    totalMembers: number;
    overdueBooks: number;
    pendingReservations: number;
    totalCategories: number;
    totalFineCollection: number;
    outstandingFines: number;
  };
  charts: {
    monthlyCirculation: Array<{
      month: string;
      issued: number;
      returned: number;
      newMembers: number;
    }>;
    categoryDistribution: Array<{ name: string; booksCount: number; copiesCount: number }>;
    mostBorrowed: Array<{ title: string; fullTitle: string; borrowCount: number }>;
    availabilitySplit: Array<{ name: string; value: number }>;
  };
  lists: {
    recentlyAddedBooks: Book[];
    popularBooks: Book[];
    recentlyIssued: IssueTransaction[];
    recentlyReturned: ReturnTransaction[];
    overdueAlerts: IssueTransaction[];
    upcomingDueDates: IssueTransaction[];
    recentActivities: AuditLogItem[];
  };
  memberPersonal?: {
    activeBorrows: number;
    outstandingFines: number;
    activeReservations: number;
    currentLoans: IssueTransaction[];
  } | null;
}

const CHART_COLORS = ['#2563EB', '#0EA5E9', '#16A34A', '#D97706', '#6366F1', '#64748B'];

export function OverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<DashboardPayload>('/api/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
        <DataTableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
        {error || 'Dashboard data unavailable.'}
      </div>
    );
  }

  const statCards = [
    { label: 'Total Books', value: data.kpis.totalBooks, sub: `${data.kpis.totalTitles} unique titles`, to: '/books' },
    { label: 'Available Books', value: data.kpis.availableBooks, sub: 'Ready on shelf', to: '/catalog' },
    { label: 'Issued Books', value: data.kpis.issuedBooks, sub: 'Active loans', to: '/issue-books' },
    { label: 'Total Members', value: data.kpis.totalMembers, sub: 'Registered patrons', to: '/members' },
    { label: 'Overdue Books', value: data.kpis.overdueBooks, sub: 'Requires follow-up', to: '/overdue', alert: data.kpis.overdueBooks > 0 },
    { label: 'Pending Reservations', value: data.kpis.pendingReservations, sub: 'Waitlist queue', to: '/reservations' },
    { label: 'Total Categories', value: data.kpis.totalCategories, sub: 'Catalog sections', to: '/categories' },
    { label: 'Total Fine Collection', value: data.kpis.totalFineCollection, prefix: '$', decimals: 2, sub: `${formatCurrency(data.kpis.outstandingFines)} outstanding`, to: '/fines' },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Library Operations Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live inventory, circulation velocity, and patron account health
          </p>
        </div>
        {user?.role !== 'MEMBER' ? (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/issue-books"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              Issue Book
            </Link>
            <Link
              to="/return-books"
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Process Return
            </Link>
          </div>
        ) : (
          <Link
            to="/catalog"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap self-start"
          >
            Browse Catalog
          </Link>
        )}
      </div>

      {/* Member Personal Summary if logged in as MEMBER */}
      {data.memberPersonal && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Your Patron Summary</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {data.memberPersonal.activeBorrows} active loans · {data.memberPersonal.activeReservations} reservations · {formatCurrency(data.memberPersonal.outstandingFines)} outstanding fines
              </p>
            </div>
            <Link to="/fines" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              View personal account
            </Link>
          </div>
        </div>
      )}

      {/* 8 Animated KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <motion.div key={card.label} variants={fadeSlideUp}>
            <Link
              to={user?.role === 'MEMBER' && !['/catalog', '/overdue', '/reservations', '/fines'].includes(card.to) ? '/catalog' : card.to}
              className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  card.alert
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                <AnimatedCounter
                  value={card.value}
                  prefix={card.prefix}
                  decimals={card.decimals}
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {card.sub}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* 6 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Monthly Book Issue Trends */}
        <motion.div
          variants={fadeSlideUp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Monthly Book Issue Trends
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            6-month outbound lending volume
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.monthlyCirculation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="issued"
                  name="Books Issued"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 2. Monthly Book Return Trends */}
        <motion.div
          variants={fadeSlideUp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Monthly Book Return Trends
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            6-month check-in volume
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.monthlyCirculation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="returned"
                  name="Books Returned"
                  stroke="#16A34A"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 3. Category-wise Book Distribution */}
        <motion.div
          variants={fadeSlideUp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Category-Wise Book Distribution
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Physical copies across subject zones
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.categoryDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="copiesCount" name="Copies" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 4. Most Borrowed Books */}
        <motion.div
          variants={fadeSlideUp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Most Borrowed Books
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Cumulative checkout frequency
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.mostBorrowed} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="title" width={135} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="borrowCount" name="Borrows" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 5. Monthly Membership Growth */}
        <motion.div
          variants={fadeSlideUp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Monthly Membership Growth
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            New patron registrations per month
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.monthlyCirculation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="newMembers"
                  name="New Members"
                  stroke="#D97706"
                  fill="#D97706"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 6. Available vs Issued Books */}
        <motion.div
          variants={fadeSlideUp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Available vs Issued Books
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Current physical copy allocation
          </p>
          <div className="h-56 w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.availabilitySplit}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {data.charts.availabilitySplit.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 pr-4 shrink-0 text-xs">
              {data.charts.availabilitySplit.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Operational Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Book Alerts & Upcoming Due Dates */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Overdue Book Alerts</h2>
              <Link to="/overdue" className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.lists.overdueAlerts.length === 0 ? (
              <p className="text-xs text-slate-500">No overdue books right now.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lists.overdueAlerts.map((item) => (
                  <div key={item._id} className="py-2.5">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.bookId?.title}
                    </div>
                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 font-mono">
                      {item.memberId?.fullName} · Due {formatDate(item.dueDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold mb-3">Upcoming Due Dates</h3>
            {data.lists.upcomingDueDates.length === 0 ? (
              <p className="text-xs text-slate-500">No loans due in the next 3 days.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lists.upcomingDueDates.map((item) => (
                  <div key={item._id} className="py-2">
                    <div className="text-xs font-medium truncate">{item.bookId?.title}</div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                      {item.memberId?.fullName} · Due {formatDate(item.dueDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recently Added & Popular Books */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recently Added Books</h2>
              <Link to="/catalog" className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                Catalog <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {data.lists.recentlyAddedBooks.map((book) => (
                <div key={book._id} className="flex items-center gap-3">
                  <BookCover src={book.coverImageUrl} title={book.title} className="w-9 h-12" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {book.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {getNameField(book.authorId)} · {book.availableCopies}/{book.totalCopies} avail
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold mb-2">Popular Books</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.lists.popularBooks.slice(0, 4).map((b) => (
                <div key={b._id} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{b.title}</span>
                  <span className="font-mono text-slate-500 shrink-0">{b.borrowCount} loans</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recently Issued / Returned / Library Activities */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold mb-3">Recent Circulation</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.lists.recentlyIssued.slice(0, 3).map((iss) => (
                <div key={iss._id} className="py-2 text-xs">
                  <div className="font-medium truncate">Issued: {iss.bookId?.title}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {iss.memberId?.fullName} · {formatDate(iss.issueDate)}
                  </div>
                </div>
              ))}
              {data.lists.recentlyReturned.slice(0, 3).map((ret) => (
                <div key={ret._id} className="py-2 text-xs">
                  <div className="font-medium truncate">Returned: {ret.bookId?.title}</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                    {ret.memberId?.fullName} · {formatDate(ret.returnDate)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold mb-2">Recent Library Activities</h3>
            <div className="space-y-2">
              {data.lists.recentActivities.slice(0, 4).map((act) => (
                <div key={act._id} className="text-xs">
                  <div className="text-slate-800 dark:text-slate-200 line-clamp-1">{act.details}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {act.action} · {formatDateTime(act.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
