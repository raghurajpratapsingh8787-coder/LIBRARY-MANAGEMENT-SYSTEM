import { AuditLog } from '../models';

export interface AuditEntryInput {
  actorUserId?: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
}

export async function recordAuditLog(entry: AuditEntryInput): Promise<void> {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
