import mongoose, { Document, Schema } from 'mongoose';

export type ReservationStatus = 'PENDING' | 'AVAILABLE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface IReservation extends Document {
  reservationCode: string;
  bookId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  reservationDate: Date;
  expiryDate: Date;
  status: ReservationStatus;
  queuePosition: number;
  notifiedAt?: Date;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    reservationCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    reservationDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'AVAILABLE', 'FULFILLED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    queuePosition: { type: Number, required: true, min: 1 },
    notifiedAt: { type: Date },
    fulfilledAt: { type: Date },
  },
  { timestamps: true }
);

// Prevent duplicate active reservations by the same member for the same book
ReservationSchema.index(
  { bookId: 1, memberId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'AVAILABLE'] } },
  }
);

export const Reservation = mongoose.model<IReservation>('Reservation', ReservationSchema);
