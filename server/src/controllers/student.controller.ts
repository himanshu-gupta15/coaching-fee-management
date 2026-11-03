import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { FeeRecord } from '../models/FeeRecord';
import { FeeStructure } from '../models/FeeStructure';
import { Payment } from '../models/Payment';
import { Student, type IStudent } from '../models/Student';
import { User } from '../models/User';
import { getAccessibleStudent } from '../services/access.service';
import { audit } from '../services/audit.service';
import { serializeFee, statusFilter, summarizeFees } from '../services/fee.service';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/ids';
import { created, ok, pageMeta } from '../utils/response';
import { startOfLocalDay } from '../utils/dates';
import { BCRYPT_ROUNDS } from './auth.controller';

const SORTS: Record<string, Record<string, 1 | -1>> = {
  name: { fullName: 1 },
  '-name': { fullName: -1 },
  admissionDate: { admissionDate: 1 },
  '-admissionDate': { admissionDate: -1 },
  studentId: { studentId: 1 },
  '-createdAt': { createdAt: -1 },
};

async function nextStudentId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STU-${year}-`;
  const last = await Student.findOne({ studentId: { $regex: `^${prefix}` } }).sort({ studentId: -1 }).select('studentId').lean();
  const n = last ? Number(last.studentId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function assertParent(parentId?: string | null) {
  if (!parentId) return;
  const p = await User.findOne({ _id: parentId, role: 'parent' });
  if (!p) throw AppError.badRequest('Selected parent account does not exist');
}
async function assertPlan(planId?: string | null) {
  if (!planId) return;
  const p = await FeeStructure.findById(planId);
  if (!p) throw AppError.badRequest('Selected fee plan does not exist');
}

/** Attach fee summary (paid / outstanding / overdue) per student in one aggregate. */
async function withFeeTotals<T extends { _id: Types.ObjectId }>(students: T[]) {
  const now = new Date();
  const ids = students.map((s) => s._id);
  const totals = await FeeRecord.aggregate([
    { $match: { student: { $in: ids }, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$student',
        totalFees: { $sum: '$amount' },
        totalPaid: { $sum: '$amountPaid' },
        outstanding: { $sum: { $subtract: ['$amount', '$amountPaid'] } },
        overdue: {
          $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', now] }, { $lt: ['$amountPaid', '$amount'] }] }, { $subtract: ['$amount', '$amountPaid'] }, 0] },
        },
      },
    },
  ]);
  const map = new Map(totals.map((t) => [String(t._id), t]));
  return students.map((s) => {
    const t = map.get(String(s._id));
    const fees = { totalFees: t?.totalFees ?? 0, totalPaid: t?.totalPaid ?? 0, outstanding: t?.outstanding ?? 0, overdue: t?.overdue ?? 0 };
    return { ...s, fees, feeStatus: fees.overdue > 0 ? 'overdue' : fees.outstanding > 0 ? 'outstanding' : 'clear' };
  });
}

export async function listStudents(req: Request, res: Response) {
  const q = req.valid!.query;
  const filter: FilterQuery<IStudent> = { deletedAt: null };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ fullName: rx }, { studentId: rx }, { email: rx }, { phone: rx }];
  }
  if (q.course) filter.course = q.course;
  if (q.batch) filter.batch = q.batch;
  if (q.status) filter.status = q.status;
  if (q.parent) filter.parent = q.parent;
  if (q.feeStatus) {
    const outstandingIds = await FeeRecord.distinct('student', statusFilter('outstanding'));
    if (q.feeStatus === 'overdue') filter._id = { $in: await FeeRecord.distinct('student', statusFilter('overdue')) };
    else if (q.feeStatus === 'outstanding') filter._id = { $in: outstandingIds };
    else filter._id = { $nin: outstandingIds };
  }
  const [items, total] = await Promise.all([
    Student.find(filter)
      .sort(SORTS[q.sort])
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('parent', 'name email phone')
      .populate('feePlan', 'name amount frequency')
      .lean(),
    Student.countDocuments(filter),
  ]);
  return ok(res, await withFeeTotals(items), pageMeta(q.page, q.limit, total));
}

export async function studentFilters(_req: Request, res: Response) {
  const [courses, batches] = await Promise.all([
    Student.distinct('course', { deletedAt: null }),
    Student.distinct('batch', { deletedAt: null }),
  ]);
  return ok(res, { courses: courses.sort(), batches: batches.sort() });
}

export async function getStudent(req: Request, res: Response) {
  const student = await getAccessibleStudent(req.user!, req.valid!.params.id);
  await student.populate([
    { path: 'parent', select: 'name email phone' },
    { path: 'feePlan', select: 'name amount frequency dueDay' },
    { path: 'user', select: 'email isActive lastLoginAt' },
  ]);
  const now = new Date();
  const [fees, payments, summary] = await Promise.all([
    FeeRecord.find({ student: student._id }).sort({ dueDate: -1 }),
    Payment.find({ student: student._id }).sort({ paidAt: -1 }).populate('feeRecord', 'title').limit(100),
    summarizeFees([student._id], now),
  ]);
  const data = student.toJSON() as Record<string, unknown>;
  // Parents/students do not need internal account metadata.
  if (req.user!.role !== 'admin') delete data.user;
  return ok(res, { student: data, summary, fees: fees.map((f) => serializeFee(f, now)), payments });
}

export async function myStudentProfile(req: Request, res: Response) {
  const s = await Student.findOne({ user: req.user!._id, deletedAt: null });
  if (!s) throw AppError.notFound('No student profile is linked to this account');
  req.valid = { ...req.valid, params: { id: String(s._id) } };
  return getStudent(req, res);
}

export async function createStudent(req: Request, res: Response) {
  const body = req.valid!.body;
  await Promise.all([assertParent(body.parent), assertPlan(body.feePlan)]);
  let userId: Types.ObjectId | null = null;
  if (body.createLogin) {
    if (!body.loginPassword) throw AppError.badRequest('A password is required to create a student login');
    if (await User.exists({ email: body.email })) throw AppError.conflict('A user account with this email already exists');
    const u = await User.create({
      name: body.fullName,
      email: body.email,
      phone: body.phone || undefined,
      passwordHash: await bcrypt.hash(body.loginPassword, BCRYPT_ROUNDS),
      role: 'student',
      createdBy: req.user!._id,
    });
    userId = u._id;
  }
  try {
    const student = await Student.create({
      studentId: body.studentId ?? (await nextStudentId()),
      fullName: body.fullName,
      email: body.email,
      phone: body.phone || undefined,
      course: body.course,
      batch: body.batch,
      admissionDate: startOfLocalDay(body.admissionDate),
      parent: body.parent ?? null,
      feePlan: body.feePlan ?? null,
      status: body.status ?? 'active',
      user: userId,
    });
    await audit(req, { action: 'student.created', entityType: 'Student', entityId: String(student._id), summary: `Added student ${student.fullName} (${student.studentId})` });
    return created(res, student);
  } catch (err) {
    if (userId) await User.deleteOne({ _id: userId });
    throw err;
  }
}

export async function updateStudent(req: Request, res: Response) {
  const body = req.valid!.body;
  await Promise.all([assertParent(body.parent), assertPlan(body.feePlan)]);
  const update: Record<string, unknown> = { ...body };
  if (body.admissionDate) update.admissionDate = startOfLocalDay(body.admissionDate);
  if (body.phone === '') update.phone = undefined;
  const student = await Student.findOneAndUpdate({ _id: req.valid!.params.id, deletedAt: null }, update, { new: true, runValidators: true });
  if (!student) throw AppError.notFound('Student not found');
  if (body.fullName && student.user) await User.updateOne({ _id: student.user }, { name: body.fullName });
  await audit(req, { action: 'student.updated', entityType: 'Student', entityId: String(student._id), summary: `Updated student ${student.fullName}`, metadata: { fields: Object.keys(body) } });
  return ok(res, student);
}

/**
 * "Delete" archives the student: hidden from lists, login disabled, but all fee
 * records and payments are retained for financial history and reports.
 */
export async function deleteStudent(req: Request, res: Response) {
  const student = await Student.findOneAndUpdate(
    { _id: req.valid!.params.id, deletedAt: null },
    { deletedAt: new Date(), status: 'inactive' },
    { new: true },
  );
  if (!student) throw AppError.notFound('Student not found');
  if (student.user) await User.updateOne({ _id: student.user }, { isActive: false });
  await audit(req, { action: 'student.archived', entityType: 'Student', entityId: String(student._id), summary: `Archived student ${student.fullName} (${student.studentId}); payment history retained` });
  return ok(res, { message: 'Student archived. Payment history has been retained.' });
}

export async function createStudentAccount(req: Request, res: Response) {
  const student = await Student.findOne({ _id: req.valid!.params.id, deletedAt: null });
  if (!student) throw AppError.notFound('Student not found');
  if (student.user) throw AppError.conflict('This student already has a login');
  if (await User.exists({ email: student.email })) throw AppError.conflict('A user with this email already exists');
  const u = await User.create({
    name: student.fullName,
    email: student.email,
    phone: student.phone,
    passwordHash: await bcrypt.hash(req.valid!.body.password, BCRYPT_ROUNDS),
    role: 'student',
    createdBy: req.user!._id,
  });
  student.user = u._id;
  await student.save();
  await audit(req, { action: 'student.login_created', entityType: 'Student', entityId: String(student._id), summary: `Created login for ${student.fullName}` });
  return created(res, { email: u.email });
}
