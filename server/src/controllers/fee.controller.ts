import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { FeeRecord, type IFeeRecord } from '../models/FeeRecord';
import { FeeStructure } from '../models/FeeStructure';
import { Payment } from '../models/Payment';
import { Student } from '../models/Student';
import { accessibleStudentIds, getAccessibleStudent } from '../services/access.service';
import { audit } from '../services/audit.service';
import { generateFeeRecords, serializeFee, statusFilter } from '../services/fee.service';
import { notifyMany } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { dueDateFromInput, startOfLocalDay } from '../utils/dates';
import { escapeRegex } from '../utils/ids';
import { formatINR } from '../utils/money';
import { created, ok, pageMeta } from '../utils/response';

// ---------- Fee structures (plans) ----------
export async function listStructures(_req: Request, res: Response) {
  const structures = await FeeStructure.find().sort({ isActive: -1, course: 1, name: 1 }).lean();
  const counts = await Student.aggregate([
    { $match: { deletedAt: null, feePlan: { $ne: null } } },
    { $group: { _id: '$feePlan', count: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return ok(res, structures.map((s) => ({ ...s, studentCount: map.get(String(s._id)) ?? 0 })));
}

export async function createStructure(req: Request, res: Response) {
  const s = await FeeStructure.create(req.valid!.body);
  await audit(req, { action: 'fee_structure.created', entityType: 'FeeStructure', entityId: String(s._id), summary: `Created fee plan ${s.name} (${formatINR(s.amount)} ${s.frequency})` });
  return created(res, s);
}

/** Changing a plan's amount affects only fee records generated afterwards. */
export async function updateStructure(req: Request, res: Response) {
  const s = await FeeStructure.findByIdAndUpdate(req.valid!.params.id, req.valid!.body, { new: true, runValidators: true });
  if (!s) throw AppError.notFound('Fee plan not found');
  await audit(req, { action: 'fee_structure.updated', entityType: 'FeeStructure', entityId: String(s._id), summary: `Updated fee plan ${s.name}`, metadata: req.valid!.body });
  return ok(res, s);
}

export async function deleteStructure(req: Request, res: Response) {
  const id = req.valid!.params.id;
  const [inUse, hasRecords] = await Promise.all([
    Student.exists({ feePlan: id, deletedAt: null }),
    FeeRecord.exists({ feeStructure: id }),
  ]);
  if (inUse || hasRecords) {
    const s = await FeeStructure.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!s) throw AppError.notFound('Fee plan not found');
    await audit(req, { action: 'fee_structure.deactivated', entityType: 'FeeStructure', entityId: id, summary: `Deactivated fee plan ${s.name} (in use, kept for history)` });
    return ok(res, { message: 'Fee plan is in use, so it was deactivated instead of deleted.', deactivated: true });
  }
  const s = await FeeStructure.findByIdAndDelete(id);
  if (!s) throw AppError.notFound('Fee plan not found');
  await audit(req, { action: 'fee_structure.deleted', entityType: 'FeeStructure', entityId: id, summary: `Deleted fee plan ${s.name}` });
  return ok(res, { message: 'Fee plan deleted', deactivated: false });
}

// ---------- Fee records ----------
export async function listFeeRecords(req: Request, res: Response) {
  const q = req.valid!.query;
  const now = new Date();
  const filter: FilterQuery<IFeeRecord> = q.status ? statusFilter(q.status, now) : {};
  const allowed = await accessibleStudentIds(req.user!);
  let studentScope: Types.ObjectId[] | null = allowed;
  if (q.student) {
    const sid = new Types.ObjectId(q.student);
    if (allowed && !allowed.some((a) => a.equals(sid))) throw AppError.notFound('Student not found');
    studentScope = [sid];
  }
  if (q.search && req.user!.role === 'admin') {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    const matches = await Student.find({ $or: [{ fullName: rx }, { studentId: rx }] }).select('_id').lean();
    const ids = matches.map((m) => m._id);
    studentScope = studentScope ? studentScope.filter((s) => ids.some((i) => i.equals(s))) : ids;
  }
  if (studentScope) filter.student = { $in: studentScope };
  if (q.feeStructure) filter.feeStructure = q.feeStructure;
  if (q.dueFrom || q.dueTo) {
    const range: Record<string, Date> = {};
    if (q.dueFrom) range.$gte = startOfLocalDay(q.dueFrom);
    if (q.dueTo) range.$lte = dueDateFromInput(q.dueTo);
    filter.dueDate = { ...(filter.dueDate as object), ...range };
  }
  const sortField = q.sort.replace('-', '');
  const sort: Record<string, 1 | -1> = { [sortField]: q.sort.startsWith('-') ? -1 : 1, _id: 1 };
  const [items, total] = await Promise.all([
    FeeRecord.find(filter)
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('student', 'fullName studentId course batch'),
    FeeRecord.countDocuments(filter),
  ]);
  return ok(res, items.map((f) => serializeFee(f, now)), pageMeta(q.page, q.limit, total));
}

export async function getFeeRecord(req: Request, res: Response) {
  const fee = await FeeRecord.findById(req.valid!.params.id).populate('feeStructure', 'name frequency');
  if (!fee) throw AppError.notFound('Fee record not found');
  const student = await getAccessibleStudent(req.user!, String(fee.student)); // IDOR guard
  const payments = await Payment.find({ feeRecord: fee._id }).sort({ paidAt: 1 }).populate('recordedBy', 'name');
  return ok(res, {
    fee: serializeFee(fee),
    student: { _id: student._id, fullName: student.fullName, studentId: student.studentId, course: student.course, batch: student.batch },
    payments,
  });
}

export async function generate(req: Request, res: Response) {
  const result = await generateFeeRecords({ ...req.valid!.body, createdBy: req.user!._id });
  await audit(req, { action: 'fee.generated', entityType: 'FeeRecord', summary: `Generated fees for ${req.valid!.body.period}: ${result.created} created, ${result.skipped} skipped`, metadata: { ...req.valid!.body, ...result } });
  return ok(res, result);
}

export async function createCustomFee(req: Request, res: Response) {
  const body = req.valid!.body;
  const student = await Student.findOne({ _id: body.studentId, deletedAt: null });
  if (!student) throw AppError.notFound('Student not found');
  const fee = await FeeRecord.create({
    student: student._id,
    feeStructure: null,
    title: body.title,
    periodKey: `CUSTOM-${crypto.randomUUID()}`,
    amount: body.amount,
    amountPaid: 0,
    dueDate: dueDateFromInput(body.dueDate),
    status: 'pending',
    notes: body.notes,
    createdBy: req.user!._id,
  });
  const recipients = [student.parent, student.user].filter(Boolean) as Types.ObjectId[];
  await notifyMany(recipients.map((user) => ({
    user, type: 'fee_due' as const, title: 'New fee added',
    message: `${fee.title} of ${formatINR(fee.amount)} has been added for ${student.fullName}.`,
    link: `/fees/${fee._id}`, dedupeKey: `due-created:${fee._id}`,
  })));
  await audit(req, { action: 'fee.created', entityType: 'FeeRecord', entityId: String(fee._id), summary: `Added fee "${fee.title}" ${formatINR(fee.amount)} for ${student.fullName}` });
  return created(res, serializeFee(fee));
}

/**
 * Admin can correct title, due date, or amount. The amount can never be set below
 * what has already been paid; status is recomputed from the payment total.
 */
export async function updateFeeRecord(req: Request, res: Response) {
  const body = req.valid!.body;
  const fee = await FeeRecord.findById(req.valid!.params.id);
  if (!fee) throw AppError.notFound('Fee record not found');
  if (fee.status === 'cancelled') throw AppError.unprocessable('FEE_CANCELLED', 'Cancelled fees cannot be edited');
  const before = { title: fee.title, amount: fee.amount, dueDate: fee.dueDate };
  if (body.amount !== undefined) {
    if (body.amount < fee.amountPaid) {
      throw AppError.unprocessable('AMOUNT_BELOW_PAID', `Amount cannot be less than the ${formatINR(fee.amountPaid)} already paid`);
    }
    // Atomic: only apply if amountPaid has not changed since we read it.
    const newStatus = fee.amountPaid >= body.amount ? 'paid' : fee.amountPaid > 0 ? 'partial' : 'pending';
    const upd = await FeeRecord.updateOne(
      { _id: fee._id, amountPaid: fee.amountPaid },
      { amount: body.amount, status: newStatus, paidAt: newStatus === 'paid' ? fee.paidAt ?? new Date() : null },
    );
    if (!upd.modifiedCount && body.amount !== fee.amount) throw AppError.conflict('A payment was recorded meanwhile. Please retry.');
  }
  const rest: Record<string, unknown> = {};
  if (body.title) rest.title = body.title;
  if (body.notes !== undefined) rest.notes = body.notes;
  if (body.dueDate) rest.dueDate = dueDateFromInput(body.dueDate);
  if (Object.keys(rest).length) await FeeRecord.updateOne({ _id: fee._id }, rest);
  const updated = await FeeRecord.findById(fee._id);
  await audit(req, { action: 'fee.updated', entityType: 'FeeRecord', entityId: String(fee._id), summary: `Updated fee "${updated!.title}"`, metadata: { before, after: body } });
  return ok(res, serializeFee(updated!));
}

/** Only fees with no payments may be cancelled (payments are never deleted). */
export async function cancelFeeRecord(req: Request, res: Response) {
  const fee = await FeeRecord.findOneAndUpdate(
    { _id: req.valid!.params.id, amountPaid: 0, status: 'pending' },
    { status: 'cancelled', cancelledReason: req.valid!.body.reason },
    { new: true },
  );
  if (!fee) {
    const exists = await FeeRecord.findById(req.valid!.params.id);
    if (!exists) throw AppError.notFound('Fee record not found');
    throw AppError.unprocessable('HAS_PAYMENTS', 'Fees with recorded payments cannot be cancelled');
  }
  await audit(req, { action: 'fee.cancelled', entityType: 'FeeRecord', entityId: String(fee._id), summary: `Cancelled fee "${fee.title}": ${req.valid!.body.reason}` });
  return ok(res, serializeFee(fee));
}
