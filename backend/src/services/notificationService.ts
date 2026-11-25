import type { Server as SocketIOServer } from 'socket.io';
import { Notification, type NotificationType } from '../models';

let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer): void {
  ioInstance = io;
}

export interface NotifyInput {
  recipientUserId?: string;
  recipientRole?: 'SUPER_ADMIN' | 'LIBRARIAN' | 'MEMBER' | 'ALL';
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
}

export async function createNotification(input: NotifyInput): Promise<void> {
  const doc = await Notification.create({
    recipientUserId: input.recipientUserId,
    recipientRole: input.recipientRole || 'ALL',
    title: input.title,
    message: input.message,
    type: input.type,
    link: input.link || '',
  });

  if (ioInstance) {
    if (input.recipientUserId) {
      ioInstance.to(`user:${input.recipientUserId}`).emit('notification:new', doc.toObject());
    } else if (input.recipientRole && input.recipientRole !== 'ALL') {
      ioInstance.to(`role:${input.recipientRole}`).emit('notification:new', doc.toObject());
    } else {
      ioInstance.emit('notification:new', doc.toObject());
    }
  }
}
