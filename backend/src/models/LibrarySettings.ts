import mongoose, { Document, Schema } from 'mongoose';

export interface ILibrarySettings extends Document {
  libraryName: string;
  adminContactName: string;
  adminContactEmail: string;
  dailyFineRate: number;
  maxFineAmount: number;
  gracePeriodDays: number;
  defaultLoanDays: number;
  reservationHoldHours: number;
  maxAllowedFineBeforeBlock: number;
  borrowingLimits: {
    STUDENT: number;
    FACULTY: number;
    STAFF: number;
    GENERAL: number;
  };
  allowMemberSelfRegistration: boolean;
  updatedAt: Date;
}

const LibrarySettingsSchema = new Schema<ILibrarySettings>(
  {
    libraryName: { type: String, default: 'Library Management System', trim: true },
    adminContactName: { type: String, default: 'Raghuraj Pratap Singh', trim: true },
    adminContactEmail: {
      type: String,
      default: 'raghurajpratapsingh8787@gmail.com',
      trim: true,
      lowercase: true,
    },
    dailyFineRate: { type: Number, default: 1.5, min: 0 },
    maxFineAmount: { type: Number, default: 50, min: 0 },
    gracePeriodDays: { type: Number, default: 1, min: 0 },
    defaultLoanDays: { type: Number, default: 14, min: 1, max: 90 },
    reservationHoldHours: { type: Number, default: 48, min: 1, max: 168 },
    maxAllowedFineBeforeBlock: { type: Number, default: 25, min: 0 },
    borrowingLimits: {
      STUDENT: { type: Number, default: 5, min: 1, max: 30 },
      FACULTY: { type: Number, default: 10, min: 1, max: 30 },
      STAFF: { type: Number, default: 7, min: 1, max: 30 },
      GENERAL: { type: Number, default: 3, min: 1, max: 30 },
    },
    allowMemberSelfRegistration: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LibrarySettings = mongoose.model<ILibrarySettings>(
  'LibrarySettings',
  LibrarySettingsSchema
);
