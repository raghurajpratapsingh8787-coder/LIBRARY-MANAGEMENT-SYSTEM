import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AppLayout } from './components/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthPage } from './pages/AuthPage';
import { BookFormPage } from './pages/BookFormPage';
import { BooksPage } from './pages/BooksPage';
import { CatalogPage } from './pages/CatalogPage';
import { FinesPage } from './pages/FinesPage';
import { IssueBooksPage } from './pages/IssueBooksPage';
import { MembersPage } from './pages/MembersPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OverduePage } from './pages/OverduePage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { ReturnBooksPage } from './pages/ReturnBooksPage';
import { SettingsPage } from './pages/SettingsPage';
import { TaxonomyPage } from './pages/TaxonomyPage';
import type { UserRole } from './types/library';

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] text-sm text-slate-500">
        Loading Library Management System...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/overview" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] text-sm text-slate-500">
        Loading Library Management System...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/overview" replace /> : <AuthPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route
          path="books"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <BooksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="books/new"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <BookFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="books/:id/edit"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <BookFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="categories"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <TaxonomyPage mode="categories" />
            </ProtectedRoute>
          }
        />
        <Route
          path="authors"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <TaxonomyPage mode="authors" />
            </ProtectedRoute>
          }
        />
        <Route
          path="publishers"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <TaxonomyPage mode="publishers" />
            </ProtectedRoute>
          }
        />
        <Route
          path="members"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <MembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="issue-books"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <IssueBooksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="return-books"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <ReturnBooksPage />
            </ProtectedRoute>
          }
        />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="overdue" element={<OverduePage />} />
        <Route path="fines" element={<FinesPage />} />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'LIBRARIAN']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? '/overview' : '/auth'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
