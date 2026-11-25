export function DataTableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
            {Array.from({ length: cols }).map((__, cIdx) => (
              <div
                key={cIdx}
                className="h-3.5 rounded bg-slate-200 dark:bg-slate-800 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
