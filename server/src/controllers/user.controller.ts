import type { Request, Response } from 'express';
import { User } from '../models/User';
import { audit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/ids';
import { ok, pageMeta } from '../utils/response';
import { createResetToken, resetUrl } from './auth.controller';

export async function listUsers(req: Request, res: Response) {
  const { page, limit, role, search } = req.valid!.query;
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ role: 1, name: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, items, pageMeta(page, limit, total));
}

export async function setUserStatus(req: Request, res: Response) {
  const { id } = req.valid!.params;
  const isActive = Boolean(req.body?.isActive);
  if (String(req.user!._id) === id && !isActive) throw AppError.badRequest('You cannot disable your own account');
  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!user) throw AppError.notFound('User not found');
  await audit(req, { action: isActive ? 'user.enabled' : 'user.disabled', entityType: 'User', entityId: id, summary: `${isActive ? 'Enabled' : 'Disabled'} account ${user.email}` });
  return ok(res, user);
}

/** Admin-issued reset link (no email provider in MVP — admin shares the link securely). */
export async function issueResetLink(req: Request, res: Response) {
  const { id } = req.valid!.params;
  const user = await User.findById(id);
  if (!user || !user.isActive) throw AppError.notFound('User not found');
  const token = await createResetToken(user);
  await audit(req, { action: 'user.reset_link_issued', entityType: 'User', entityId: id, summary: `Issued password reset link for ${user.email}` });
  return ok(res, { resetUrl: resetUrl(token), expiresInMinutes: 30 });
}
