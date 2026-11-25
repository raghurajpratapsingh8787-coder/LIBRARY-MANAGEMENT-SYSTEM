import mongoose, { Document, Schema } from 'mongoose';

export type BookStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'ARCHIVED';

export interface IBook extends Document {
  bookCode: string;
  isbn: string;
  title: string;
  authorId: mongoose.Types.ObjectId;
  publisherId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  description: string;
  coverImageUrl: string;
  publicationDate: Date;
  edition: string;
  language: string;
  shelfNumber: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  status: BookStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>(
  {
    bookCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    isbn: { type: String, required: true, unique: true, trim: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'Author', required: true, index: true },
    publisherId: { type: Schema.Types.ObjectId, ref: 'Publisher', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    coverImageUrl: { type: String, default: '' },
    publicationDate: { type: Date, required: true },
    edition: { type: String, trim: true, maxlength: 60, default: '1st Edition' },
    language: { type: String, trim: true, maxlength: 60, default: 'English' },
    shelfNumber: { type: String, required: true, trim: true, maxlength: 40 },
    totalCopies: { type: Number, required: true, min: 0 },
    availableCopies: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (value: number) {
          const doc = this as unknown as { totalCopies?: number };
          return doc.totalCopies === undefined || value <= doc.totalCopies;
        },
        message: 'Available copies cannot exceed total copies.',
      },
    },
    borrowCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OUT_OF_STOCK', 'ARCHIVED'],
      default: 'AVAILABLE',
      index: true,
    },
  },
  { timestamps: true }
);

BookSchema.index({ title: 'text', isbn: 'text', description: 'text' });

export const Book = mongoose.model<IBook>('Book', BookSchema);
