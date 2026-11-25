import { Printer, Download } from 'lucide-react';
import { Modal } from './Modal';
import { exportReceiptPdf } from '../utils/pdfExport';
import { useAuth } from '../context/AuthContext';

export interface ReceiptData {
  title: string;
  code: string;
  filename: string;
  fields: Array<{ label: string; value: string }>;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const { libraryName } = useAuth();

  if (!receipt) return null;

  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title={receipt.title}
      subtitle={`Reference ${receipt.code}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {receipt.fields.map((field) => (
            <div key={field.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="text-slate-500 dark:text-slate-400">{field.label}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 text-right font-mono tabular-nums">
                {field.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
          <button
            type="button"
            onClick={() =>
              exportReceiptPdf({
                receiptTitle: receipt.title,
                receiptCode: receipt.code,
                libraryName,
                fields: receipt.fields,
                filename: receipt.filename,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
