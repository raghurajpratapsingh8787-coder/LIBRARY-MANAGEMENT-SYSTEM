import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    isRevoked: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>('Session', SessionSchema);
