import { CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/formatters';

export function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useAuth();
  const { pushToast } = useToast();

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    pushToast('All notifications marked as read.', 'success');
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time circulation alerts, reservation holds, and system notices
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAll}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark All Read
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            You have no notifications at this time.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              className={`p-4 flex items-start justify-between gap-4 ${
                !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {n.title}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {n.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                <div className="text-[11px] font-mono text-slate-400 mt-1.5">
                  {formatDateTime(n.createdAt)}
                </div>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => markNotificationRead(n._id)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
