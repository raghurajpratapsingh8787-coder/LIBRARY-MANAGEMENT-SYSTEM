import mongoose, { Document, Schema } from 'mongoose';

export type BookCopyStatus = 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'DAMAGED' | 'LOST';

export interface IBookCopy extends Document {
  bookId: mongoose.Types.ObjectId;
  accessionNumber: string;
  barcode: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'WORN';
  status: BookCopyStatus;
  rackLocation: string;
  acquiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookCopySchema = new Schema<IBookCopy>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    accessionNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, required: true, unique: true, trim: true },
    condition: { type: String, enum: ['NEW', 'GOOD', 'FAIR', 'WORN'], default: 'GOOD' },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ISSUED', 'RESERVED', 'DAMAGED', 'LOST'],
      default: 'AVAILABLE',
      index: true,
    },
    rackLocation: { type: String, trim: true, default: '' },
    acquiredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const BookCopy = mongoose.model<IBookCopy>('BookCopy', BookCopySchema);
