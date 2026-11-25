import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  code: string;
  description?: string;
  shelfZone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, unique: true, uppercase: true, maxlength: 20 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    shelfZone: { type: String, trim: true, maxlength: 50, default: '' },
  },
  { timestamps: true }
);

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
