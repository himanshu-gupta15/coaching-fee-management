import type { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { audit } from '../services/audit.service';
import { runFeeReminders } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { ok, pageMeta } from '../utils/response';

export async function listNotifications(req: Request, res: Response) {
  const { page, limit, unread } = req.valid!.query;
  const filter: Record<string, unknown> = { user: req.user!._id };
  if (unread === 'true') filter.read = false;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user!._id, read: false }),
  ]);
  return ok(res, items, { ...pageMeta(page, limit, total), unreadCount });
}

export async function markRead(req: Request, res: Response) {
  // Scoped by user: a user can only mark their own notifications.
  const n = await Notification.findOneAndUpdate({ _id: req.valid!.params.id, user: req.user!._id }, { read: true, readAt: new Date() }, { new: true });
  if (!n) throw AppError.notFound('Notification not found');
  return ok(res, n);
}

export async function markAllRead(req: Request, res: Response) {
  const r = await Notification.updateMany({ user: req.user!._id, read: false }, { read: true, readAt: new Date() });
  return ok(res, { updated: r.modifiedCount });
}

export async function triggerReminders(req: Request, res: Response) {
  const result = await runFeeReminders();
  await audit(req, { action: 'notifications.reminders_run', entityType: 'Notification', summary: `Ran fee reminders: ${result.inserted ?? 0} new notifications`, metadata: result });
  return ok(res, result);
}
