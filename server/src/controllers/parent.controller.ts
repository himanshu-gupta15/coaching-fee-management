import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Payment } from '../models/Payment';
import { FeeRecord } from '../models/FeeRecord';
import { Student } from '../models/Student';
import { User, type IUser } from '../models/User';
import { Announcement } from '../models/Announcement';
import { Notification } from '../models/Notification';
import { audit } from '../services/audit.service';
import { serializeFee, summarizeFees } from '../services/fee.service';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/ids';
import { created, ok, pageMeta } from '../utils/response';
import { BCRYPT_ROUNDS } from './auth.controller';

export async function listParents(req: Request, res: Response) {
  const { page, limit, search, status } = req.valid!.query;
  const filter: FilterQuery<IUser> = { role: 'parent' };
  if (status) filter.isActive = status === 'active';
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [parents, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const children = await Student.find({ parent: { $in: parents.map((p) => p._id) }, deletedAt: null })
    .select('fullName studentId course batch parent status')
    .lean();
  const items = parents.map((p) => {
    const { passwordHash: _ph, resetTokenHash: _rt, resetTokenExpiresAt: _re, __v: _v, ...rest } = p as IUser & { __v?: number; _id: unknown };
    return { ...rest, children: children.filter((c) => String(c.parent) === String(p._id)) };
  });
  return ok(res, items, pageMeta(page, limit, total));
}

export async function getParent(req: Request, res: Response) {
  const parent = await User.findOne({ _id: req.valid!.params.id, role: 'parent' });
  if (!parent) throw AppError.notFound('Parent not found');
  const children = await Student.find({ parent: parent._id, deletedAt: null }).lean();
  const summary = await summarizeFees(children.map((c) => c._id));
  return ok(res, { parent, children, summary });
}

export async function createParent(req: Request, res: Response) {
  const body = req.valid!.body;
  if (await User.exists({ email: body.email })) throw AppError.conflict('An account with this email already exists');
  const parent = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone || undefined,
    passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
    role: 'parent', // role is set by the server, never taken from input
    createdBy: req.user!._id,
  });
  if (body.studentIds?.length) {
    await Student.updateMany({ _id: { $in: body.studentIds }, deletedAt: null }, { parent: parent._id });
  }
  await audit(req, { action: 'parent.created', entityType: 'User', entityId: String(parent._id), summary: `Created parent account ${parent.email}` });
  return created(res, parent);
}

export async function updateParent(req: Request, res: Response) {
  const body = req.valid!.body;
  if (body.email && (await User.exists({ email: body.email, _id: { $ne: req.valid!.params.id } }))) {
    throw AppError.conflict('An account with this email already exists');
  }
  const parent = await User.findOneAndUpdate({ _id: req.valid!.params.id, role: 'parent' }, body, { new: true, runValidators: true });
  if (!parent) throw AppError.notFound('Parent not found');
  await audit(req, { action: 'parent.updated', entityType: 'User', entityId: String(parent._id), summary: `Updated parent ${parent.email}`, metadata: { fields: Object.keys(body) } });
  return ok(res, parent);
}

export async function linkStudent(req: Request, res: Response) {
  const parent = await User.findOne({ _id: req.valid!.params.id, role: 'parent' });
  if (!parent) throw AppError.notFound('Parent not found');
  const student = await Student.findOneAndUpdate({ _id: req.valid!.body.studentId, deletedAt: null }, { parent: parent._id }, { new: true });
  if (!student) throw AppError.notFound('Student not found');
  await audit(req, { action: 'parent.student_linked', entityType: 'Student', entityId: String(student._id), summary: `Linked ${student.fullName} to parent ${parent.email}` });
  return ok(res, student);
}

export async function unlinkStudent(req: Request, res: Response) {
  const { id, studentId } = req.valid!.params;
  const student = await Student.findOneAndUpdate({ _id: studentId, parent: id }, { parent: null }, { new: true });
  if (!student) throw AppError.notFound('This student is not linked to that parent');
  await audit(req, { action: 'parent.student_unlinked', entityType: 'Student', entityId: String(student._id), summary: `Unlinked ${student.fullName} from parent ${id}` });
  return ok(res, student);
}

/** Parent portal home: everything scoped strictly to the signed-in parent's children. */
export async function parentDashboard(req: Request, res: Response) {
  const now = new Date();
  const children = await Student.find({ parent: req.user!._id, deletedAt: null }).populate('feePlan', 'name amount frequency').lean();
  const ids = children.map((c) => c._id);
  const [summary, upcoming, recentPayments, unread, announcements, perChild] = await Promise.all([
    summarizeFees(ids, now),
    FeeRecord.find({ student: { $in: ids }, status: { $in: ['pending', 'partial'] } })
      .sort({ dueDate: 1 })
      .limit(8)
      .populate('student', 'fullName studentId'),
    Payment.find({ student: { $in: ids } }).sort({ paidAt: -1 }).limit(5).populate('student', 'fullName').populate('feeRecord', 'title'),
    Notification.countDocuments({ user: req.user!._id, read: false }),
    Announcement.find({ audience: { $in: ['all', 'parents'] } }).sort({ pinned: -1, createdAt: -1 }).limit(3),
    Promise.all(ids.map((id) => summarizeFees([id], now))),
  ]);
  return ok(res, {
    children: children.map((c, i) => ({ ...c, summary: perChild[i] })),
    summary,
    upcoming: upcoming.map((f) => serializeFee(f, now)),
    recentPayments,
    unreadNotifications: unread,
    announcements,
  });
}
