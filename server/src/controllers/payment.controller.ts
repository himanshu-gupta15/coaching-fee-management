import type { Request, Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { Payment, type IPayment } from '../models/Payment';
import { FeeRecord } from '../models/FeeRecord';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { accessibleStudentIds, assertStudentAccess } from '../services/access.service';
import { recordPayment } from '../services/payment.service';
import { renderReceiptPdf } from '../services/receipt.service';
import { AppError } from '../utils/AppError';
import { dueDateFromInput, startOfLocalDay } from '../utils/dates';
import { escapeRegex } from '../utils/ids';
import { created, ok, pageMeta } from '../utils/response';

export async function createPayment(req: Request, res: Response) {
  const b = req.valid!.body;
  const payment = await recordPayment(req, {
    ...b,
    // A date-only payment date is stored as midday local time to avoid TZ edge cases.
    paidAt: b.paidAt ? new Date(startOfLocalDay(b.paidAt).getTime() + 12 * 3600_000) : undefined,
  });
  const fee = await FeeRecord.findById(payment.feeRecord);
  return created(res, { payment, fee: fee ? { _id: fee._id, amount: fee.amount, amountPaid: fee.amountPaid, status: fee.status, balance: fee.amount - fee.amountPaid } : null });
}

export async function listPayments(req: Request, res: Response) {
  const q = req.valid!.query;
  const filter: FilterQuery<IPayment> = {};
  const allowed = await accessibleStudentIds(req.user!);
  let scope: Types.ObjectId[] | null = allowed;
  if (q.student) {
    const sid = new Types.ObjectId(q.student);
    if (allowed && !allowed.some((a) => a.equals(sid))) throw AppError.notFound('Student not found');
    scope = [sid];
  }
  if (q.search && req.user!.role === 'admin') {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    const students = await Student.find({ $or: [{ fullName: rx }, { studentId: rx }] }).select('_id').lean();
    filter.$or = [{ transactionId: rx }, { receiptNumber: rx }, { reference: rx }, { student: { $in: students.map((s) => s._id) } }];
  }
  if (scope) filter.student = { $in: scope };
  if (q.feeRecord) filter.feeRecord = q.feeRecord;
  if (q.method) filter.method = q.method;
  if (q.from || q.to) {
    filter.paidAt = {};
    if (q.from) filter.paidAt.$gte = startOfLocalDay(q.from);
    if (q.to) filter.paidAt.$lte = dueDateFromInput(q.to);
  }
  const [items, total, sum] = await Promise.all([
    Payment.find(filter)
      .sort({ paidAt: -1, _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('student', 'fullName studentId course batch')
      .populate('feeRecord', 'title amount')
      .populate('recordedBy', 'name'),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  return ok(res, items, { ...pageMeta(q.page, q.limit, total), totalAmount: sum[0]?.total ?? 0 });
}

async function loadAccessiblePayment(req: Request) {
  const p = await Payment.findById(req.valid!.params.id)
    .populate('student', 'fullName studentId course batch parent')
    .populate('feeRecord', 'title amount dueDate amountPaid status')
    .populate('recordedBy', 'name');
  if (!p) throw AppError.notFound('Payment not found');
  await assertStudentAccess(req.user!, (p.student as unknown as { _id: Types.ObjectId })._id).catch(() => {
    throw AppError.notFound('Payment not found');
  });
  return p;
}

export async function getPayment(req: Request, res: Response) {
  return ok(res, await loadAccessiblePayment(req));
}

export async function downloadReceipt(req: Request, res: Response) {
  const p = await loadAccessiblePayment(req);
  const student = p.student as unknown as { fullName: string; studentId: string; course: string; batch: string; parent?: Types.ObjectId };
  const fee = p.feeRecord as unknown as { title: string; amount: number; dueDate: Date };
  const parent = student.parent ? await User.findById(student.parent).select('name').lean() : null;
  const pdf = await renderReceiptPdf({
    receiptNumber: p.receiptNumber,
    transactionId: p.transactionId,
    paidAt: p.paidAt,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    balanceAfter: p.balanceAfter,
    student,
    parentName: parent?.name,
    fee,
    recordedBy: (p.recordedBy as unknown as { name?: string })?.name,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${p.receiptNumber}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}
