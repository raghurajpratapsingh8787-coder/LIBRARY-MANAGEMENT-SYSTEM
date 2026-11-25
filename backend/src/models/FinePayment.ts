import mongoose, { Document, Schema } from 'mongoose';

export interface IFinePayment extends Document {
  receiptNumber: string;
  fineId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  receivedByUserId: mongoose.Types.ObjectId;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CARD_DESK' | 'BANK_TRANSFER' | 'WAIVER';
  paymentDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FinePaymentSchema = new Schema<IFinePayment>(
  {
    receiptNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fineId: { type: Schema.Types.ObjectId, ref: 'Fine', required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    receivedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD_DESK', 'BANK_TRANSFER', 'WAIVER'],
      default: 'CASH',
    },
    paymentDate: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { timestamps: true }
);

export const FinePayment = mongoose.model<IFinePayment>('FinePayment', FinePaymentSchema);
