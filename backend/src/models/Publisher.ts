import mongoose, { Document, Schema } from 'mongoose';

export interface IPublisher extends Document {
  name: string;
  country?: string;
  website?: string;
  contactEmail?: string;
  foundedYear?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PublisherSchema = new Schema<IPublisher>(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 140 },
    country: { type: String, trim: true, maxlength: 80, default: '' },
    website: { type: String, trim: true, maxlength: 300, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 140, default: '' },
    foundedYear: { type: Number, min: 1400, max: 2100 },
  },
  { timestamps: true }
);

export const Publisher = mongoose.model<IPublisher>('Publisher', PublisherSchema);
