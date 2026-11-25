import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportTableReportPdf(params: {
  title: string;
  libraryName?: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  filename: string;
}): void {
  const doc = new jsPDF({ orientation: params.columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(16);
  doc.text(params.libraryName || 'Folio Ledger Library', 14, 16);
  doc.setFontSize(12);
  doc.text(params.title, 14, 24);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 30);

  autoTable(doc, {
    startY: 36,
    head: [params.columns],
    body: params.rows.map((r) => r.map((c) => String(c ?? ''))),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(params.filename);
}

export function exportReceiptPdf(params: {
  receiptTitle: string;
  receiptCode: string;
  libraryName?: string;
  fields: Array<{ label: string; value: string }>;
  filename: string;
}): void {
  const doc = new jsPDF({ unit: 'mm', format: [148, 210] });
  doc.setFontSize(15);
  doc.text(params.libraryName || 'Folio Ledger Library', 14, 18);
  doc.setFontSize(11);
  doc.text(params.receiptTitle, 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Receipt Reference: ${params.receiptCode}`, 14, 32);
  doc.text(`Issued: ${new Date().toLocaleString()}`, 14, 37);

  autoTable(doc, {
    startY: 44,
    head: [['Field', 'Details']],
    body: params.fields.map((f) => [f.label, f.value]),
    styles: { fontSize: 9.5, cellPadding: 3.5 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(params.filename);
}
