import mongoose, { Document, Schema } from 'mongoose';

export type IssueStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE';

export interface IIssueTransaction extends Document {
  transactionCode: string;
  bookId: mongoose.Types.ObjectId;
  bookCopyId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  issuedByUserId: mongoose.Types.ObjectId;
  issueDate: Date;
  dueDate: Date;
  returnedDate?: Date;
  status: IssueStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IssueTransactionSchema = new Schema<IIssueTransaction>(
  {
    transactionCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    bookCopyId: { type: Schema.Types.ObjectId, ref: 'BookCopy', required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    issuedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    issueDate: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date, required: true, index: true },
    returnedDate: { type: Date },
    status: {
      type: String,
      enum: ['ISSUED', 'RETURNED', 'OVERDUE'],
      default: 'ISSUED',
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

// Prevent the same physical copy from having two concurrent active issues
IssueTransactionSchema.index(
  { bookCopyId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['ISSUED', 'OVERDUE'] } },
  }
);

export const IssueTransaction = mongoose.model<IIssueTransaction>(
  'IssueTransaction',
  IssueTransactionSchema
);
