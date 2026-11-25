export function downloadDelimitedFile(
  filename: string,
  columns: string[],
  rows: Array<Array<string | number>>,
  delimiter = ','
): void {
  const escapeCell = (val: string | number) => {
    const raw = String(val ?? '');
    const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const lines = [
    columns.map(escapeCell).join(delimiter),
    ...rows.map((r) => r.map(escapeCell).join(delimiter)),
  ];

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], {
    type: delimiter === '\t' ? 'application/vnd.ms-excel;charset=utf-8;' : 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
