import mongoose, { Document, Schema } from 'mongoose';

export interface IAuthor extends Document {
  name: string;
  biography?: string;
  nationality?: string;
  birthYear?: number;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuthorSchema = new Schema<IAuthor>(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
    biography: { type: String, trim: true, maxlength: 2000, default: '' },
    nationality: { type: String, trim: true, maxlength: 80, default: '' },
    birthYear: { type: Number, min: 1000, max: 2100 },
    website: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

AuthorSchema.index({ name: 'text' });

export const Author = mongoose.model<IAuthor>('Author', AuthorSchema);
