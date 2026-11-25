export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

export function getStatusLabelColor(status: string): { label: string; className: string } {
  switch (status) {
    case 'AVAILABLE':
    case 'ACTIVE':
    case 'PAID':
    case 'FULFILLED':
    case 'RETURNED':
      return {
        label: status.replace(/_/g, ' '),
        className: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'ISSUED':
    case 'PENDING':
    case 'PARTIALLY_PAID':
      return {
        label: status.replace(/_/g, ' '),
        className: 'text-amber-700 dark:text-amber-400',
      };
    case 'OVERDUE':
    case 'SUSPENDED':
    case 'EXPIRED':
    case 'OUT_OF_STOCK':
    case 'UNPAID':
    case 'DAMAGED':
    case 'LOST':
      return {
        label: status.replace(/_/g, ' '),
        className: 'text-red-700 dark:text-red-400',
      };
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'text-slate-600 dark:text-slate-400',
      };
  }
}

export function getNameField(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'name' in val) return String((val as { name: string }).name);
  if (typeof val === 'object' && 'fullName' in val) return String((val as { fullName: string }).fullName);
  return '—';
}
