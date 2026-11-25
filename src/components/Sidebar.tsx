import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  PlusSquare,
  Library,
  Tags,
  Users2,
  Building2,
  UserCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  AlertCircle,
  Receipt,
  BarChart3,
  Bell,
  Settings,
  UserCircle,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/library';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Workspace',
    items: [
      { label: 'Overview', to: '/overview', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
      { label: 'Catalog', to: '/catalog', icon: Library, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
      { label: 'Notifications', to: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
    ],
  },
  {
    heading: 'Collection',
    items: [
      { label: 'Books', to: '/books', icon: BookOpen, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Add New Book', to: '/books/new', icon: PlusSquare, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Book Categories', to: '/categories', icon: Tags, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Authors', to: '/authors', icon: Users2, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Publishers', to: '/publishers', icon: Building2, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
    ],
  },
  {
    heading: 'Circulation',
    items: [
      { label: 'Members', to: '/members', icon: UserCheck, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Issue Books', to: '/issue-books', icon: ArrowUpRight, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Return Books', to: '/return-books', icon: ArrowDownLeft, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Reservations', to: '/reservations', icon: Clock, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
      { label: 'Overdue Books', to: '/overdue', icon: AlertCircle, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
      { label: 'Fine Management', to: '/fines', icon: Receipt, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'LIBRARIAN'] },
      { label: 'Settings', to: '/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
      { label: 'Profile', to: '/profile', icon: UserCircle, roles: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'] },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, logout, libraryName } = useAuth();
  const role = user?.role || 'MEMBER';

  const navContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800 w-64">
      <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
            FL
          </div>
          <span className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
            {libraryName.split(' ')[0]} Ledger
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Primary sidebar" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.heading}>
              <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wide">
                {group.heading}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/books'}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
          />
          <aside className="relative z-10 h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
}
