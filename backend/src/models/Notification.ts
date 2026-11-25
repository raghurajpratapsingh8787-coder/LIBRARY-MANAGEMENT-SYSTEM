import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'BOOK_ISSUED'
  | 'BOOK_RETURNED'
  | 'OVERDUE_ALERT'
  | 'RESERVATION_AVAILABLE'
  | 'FINE_ASSESSED'
  | 'FINE_PAID'
  | 'SYSTEM';

export interface INotification extends Document {
  recipientUserId?: mongoose.Types.ObjectId;
  recipientRole?: 'SUPER_ADMIN' | 'LIBRARIAN' | 'MEMBER' | 'ALL';
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    recipientRole: {
      type: String,
      enum: ['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER', 'ALL'],
      default: 'ALL',
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 600 },
    type: {
      type: String,
      enum: [
        'BOOK_ISSUED',
        'BOOK_RETURNED',
        'OVERDUE_ALERT',
        'RESERVATION_AVAILABLE',
        'FINE_ASSESSED',
        'FINE_PAID',
        'SYSTEM',
      ],
      default: 'SYSTEM',
    },
    isRead: { type: Boolean, default: false, index: true },
    link: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
