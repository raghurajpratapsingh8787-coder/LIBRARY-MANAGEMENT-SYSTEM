import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import { downloadDelimitedFile } from '../utils/csvExport';
import { exportTableReportPdf } from '../utils/pdfExport';

const REPORT_TYPES = [
  { id: 'total-books', label: 'Total Books Report' },
  { id: 'available-books', label: 'Available Books Report' },
  { id: 'issued-books', label: 'Issued Books Report' },
  { id: 'overdue-books', label: 'Overdue Books Report' },
  { id: 'member-activity', label: 'Member Activity Report' },
  { id: 'borrowing-history', label: 'Book Borrowing History' },
  { id: 'most-borrowed', label: 'Most Borrowed Books' },
  { id: 'category-inventory', label: 'Category-Wise Inventory' },
  { id: 'monthly-issue', label: 'Monthly Issue Report' },
  { id: 'monthly-return', label: 'Monthly Return Report' },
  { id: 'fine-collection', label: 'Fine Collection Report' },
  { id: 'membership', label: 'Membership Report' },
];

interface ReportResult {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

export function ReportsPage() {
  const { libraryName } = useAuth();
  const { pushToast } = useToast();

  const [reportType, setReportType] = useState('total-books');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set('from', fromDate);
      if (toDate) qs.set('to', toDate);
      if (search.trim()) qs.set('search', search.trim());
      const res = await apiFetch<ReportResult>(`/api/reports/${reportType}?${qs.toString()}`);
      setReport(res);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to generate report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, fromDate, toDate]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live database reports with date-range filtering and PDF, CSV, Excel, and print exports
          </p>
        </div>

        {report && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                exportTableReportPdf({
                  title: report.title,
                  libraryName,
                  columns: report.columns,
                  rows: report.rows,
                  filename: `${reportType}-report.pdf`,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={() =>
                downloadDelimitedFile(`${reportType}-report.csv`, report.columns, report.rows, ',')
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={() =>
                downloadDelimitedFile(`${reportType}-excel.xls`, report.columns, report.rows, '\t')
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          aria-label="Select report type"
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {REPORT_TYPES.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label="From date"
          className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          aria-label="To date"
          className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        <div className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter keyword..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={loadReport}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-700 text-white"
          >
            Run
          </button>
        </div>
      </div>

      {loading ? (
        <DataTableSkeleton rows={6} cols={5} />
      ) : report ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{report.title}</h2>
            <span className="text-xs font-mono text-slate-400">
              {report.rows.length} records
            </span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                {report.columns.map((col) => (
                  <th key={col} className="py-3 px-4">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={report.columns.length} className="py-10 text-center text-slate-500">
                    No records matched this report filter.
                  </td>
                </tr>
              ) : (
                report.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-4 font-mono">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
