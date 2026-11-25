import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  actorUserId?: mongoose.Types.ObjectId;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String, required: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: String, trim: true },
    details: { type: String, required: true, maxlength: 1000 },
    ipAddress: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
