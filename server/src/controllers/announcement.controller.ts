import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Announcement } from '../models/Announcement';
import { User } from '../models/User';
import { audit } from '../services/audit.service';
import { notifyMany } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/response';

export async function listAnnouncements(req: Request, res: Response) {
  const role = req.user!.role;
  const filter = role === 'admin' ? {} : { audience: { $in: ['all', role === 'parent' ? 'parents' : 'students'] } };
  const items = await Announcement.find(filter).sort({ pinned: -1, createdAt: -1 }).limit(100).populate('createdBy', 'name');
  return ok(res, items);
}

export async function createAnnouncement(req: Request, res: Response) {
  const a = await Announcement.create({ ...req.valid!.body, createdBy: req.user!._id });
  const roles = a.audience === 'all' ? ['parent', 'student'] : [a.audience === 'parents' ? 'parent' : 'student'];
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id').lean();
  await notifyMany(users.map((u) => ({
    user: u._id as Types.ObjectId, type: 'announcement' as const, title: a.title,
    message: a.body.length > 180 ? `${a.body.slice(0, 177)}...` : a.body,
    link: '/announcements', dedupeKey: `announcement:${a._id}`,
  })));
  await audit(req, { action: 'announcement.created', entityType: 'Announcement', entityId: String(a._id), summary: `Posted announcement "${a.title}" to ${a.audience}` });
  return created(res, a);
}

export async function updateAnnouncement(req: Request, res: Response) {
  const a = await Announcement.findByIdAndUpdate(req.valid!.params.id, req.valid!.body, { new: true, runValidators: true });
  if (!a) throw AppError.notFound('Announcement not found');
  await audit(req, { action: 'announcement.updated', entityType: 'Announcement', entityId: String(a._id), summary: `Updated announcement "${a.title}"` });
  return ok(res, a);
}

export async function deleteAnnouncement(req: Request, res: Response) {
  const a = await Announcement.findByIdAndDelete(req.valid!.params.id);
  if (!a) throw AppError.notFound('Announcement not found');
  await audit(req, { action: 'announcement.deleted', entityType: 'Announcement', entityId: String(a._id), summary: `Deleted announcement "${a.title}"` });
  return ok(res, { message: 'Announcement deleted' });
}
