import mongoose, { Document, Schema } from 'mongoose';

export type FineStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';

export interface IFine extends Document {
  fineCode: string;
  memberId: mongoose.Types.ObjectId;
  issueTransactionId: mongoose.Types.ObjectId;
  returnTransactionId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  overdueDays: number;
  dailyRateApplied: number;
  amount: number;
  paidAmount: number;
  status: FineStatus;
  reason: string;
  waivedByUserId?: mongoose.Types.ObjectId;
  waiverReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FineSchema = new Schema<IFine>(
  {
    fineCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    issueTransactionId: { type: Schema.Types.ObjectId, ref: 'IssueTransaction', required: true },
    returnTransactionId: { type: Schema.Types.ObjectId, ref: 'ReturnTransaction', required: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    overdueDays: { type: Number, required: true, min: 0 },
    dailyRateApplied: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED'],
      default: 'UNPAID',
      index: true,
    },
    reason: { type: String, trim: true, default: 'Overdue return fine' },
    waivedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    waiverReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const Fine = mongoose.model<IFine>('Fine', FineSchema);
