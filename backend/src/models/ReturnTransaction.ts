import mongoose, { Document, Schema } from 'mongoose';

export interface IReturnTransaction extends Document {
  returnCode: string;
  issueTransactionId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  bookCopyId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  processedByUserId: mongoose.Types.ObjectId;
  returnDate: Date;
  overdueDays: number;
  fineAmount: number;
  conditionOnReturn: 'NEW' | 'GOOD' | 'FAIR' | 'WORN' | 'DAMAGED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnTransactionSchema = new Schema<IReturnTransaction>(
  {
    returnCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    issueTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'IssueTransaction',
      required: true,
      unique: true,
    },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    bookCopyId: { type: Schema.Types.ObjectId, ref: 'BookCopy', required: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    processedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    returnDate: { type: Date, required: true, default: Date.now, index: true },
    overdueDays: { type: Number, required: true, min: 0 },
    fineAmount: { type: Number, required: true, min: 0 },
    conditionOnReturn: {
      type: String,
      enum: ['NEW', 'GOOD', 'FAIR', 'WORN', 'DAMAGED'],
      default: 'GOOD',
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

export const ReturnTransaction = mongoose.model<IReturnTransaction>(
  'ReturnTransaction',
  ReturnTransactionSchema
);
