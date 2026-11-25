import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'LIBRARIAN' | 'MEMBER';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  memberId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER'],
      default: 'MEMBER',
      index: true,
    },
    avatarUrl: { type: String, default: '' },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
