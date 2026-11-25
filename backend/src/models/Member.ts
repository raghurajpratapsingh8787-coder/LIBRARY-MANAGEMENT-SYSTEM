import mongoose, { Document, Schema } from 'mongoose';

export type MembershipType = 'STUDENT' | 'FACULTY' | 'STAFF' | 'GENERAL';
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface IMember extends Document {
  memberCode: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
  address: string;
  membershipType: MembershipType;
  registrationDate: Date;
  membershipExpiryDate: Date;
  status: MemberStatus;
  maxBorrowLimit: number;
  activeBorrowCount: number;
  outstandingFineBalance: number;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    memberCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 140, index: true },
    profilePhotoUrl: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, required: true, trim: true, maxlength: 30 },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'],
      default: 'PREFER_NOT_TO_SAY',
    },
    address: { type: String, required: true, trim: true, maxlength: 400 },
    membershipType: {
      type: String,
      enum: ['STUDENT', 'FACULTY', 'STAFF', 'GENERAL'],
      default: 'GENERAL',
      index: true,
    },
    registrationDate: { type: Date, default: Date.now },
    membershipExpiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    maxBorrowLimit: { type: Number, default: 5, min: 1, max: 30 },
    activeBorrowCount: { type: Number, default: 0, min: 0 },
    outstandingFineBalance: { type: Number, default: 0, min: 0 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Member = mongoose.model<IMember>('Member', MemberSchema);
