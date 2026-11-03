import type { Request, Response } from 'express';
import type { FilterQuery, PipelineStage } from 'mongoose';
import { env } from '../config/env';
import { AuditLog } from '../models/AuditLog';
import { FeeRecord, type IFeeRecord } from '../models/FeeRecord';
import { Payment } from '../models/Payment';
import { Student } from '../models/Student';
import { serializeFee, statusFilter, summarizeFees } from '../services/fee.service';
import { toCSV } from '../utils/csv';
import { dueDateFromInput, localParts, monthLabel, startOfLocalDay } from '../utils/dates';
import { paiseToRupeeString } from '../utils/money';
import { escapeRegex } from '../utils/ids';
import { ok, pageMeta } from '../utils/response';

const tz = () => {
  const m = env.INSTITUTE_TZ_OFFSET_MINUTES;
  const sign = m >= 0 ? '+' : '-';
  const a = Math.abs(m);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};

function range(q: { from?: string; to?: string }, defaultMonths = 6) {
  const now = new Date();
  let from: Date;
  if (q.from) from = startOfLocalDay(q.from);
  else {
    const { year, month } = localParts(now);
    const d = new Date(Date.UTC(year, month - (defaultMonths - 1), 1));
    from = startOfLocalDay(d.toISOString().slice(0, 10));
  }
  const to = q.to ? dueDateFromInput(q.to) : now;
  return { from, to };
}

/** Monthly collection buckets, including empty months, between from and to. */
async function monthlyCollections(from: Date, to: Date) {
  const rows = await Payment.aggregate([
    { $match: { paidAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: tz() } },
        collected: { $sum: '$amount' },
        count: { $sum: 1 },
        cash: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
        bank: { $sum: { $cond: [{ $eq: ['$method', 'bank_transfer'] }, '$amount', 0] } },
        online: { $sum: { $cond: [{ $eq: ['$method', 'online_manual'] }, '$amount', 0] } },
      },
    },
  ]);
  const billed = await FeeRecord.aggregate([
    { $match: { dueDate: { $gte: from, $lte: new Date(to.getTime() + 31 * 86_400_000) }, status: { $ne: 'cancelled' } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$dueDate', timezone: tz() } }, billed: { $sum: '$amount' } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r]));
  const bmap = new Map(billed.map((b) => [b._id, b.billed]));
  const out = [];
  const s = localParts(from);
  const e = localParts(to);
  for (let y = s.year, m = s.month; y < e.year || (y === e.year && m <= e.month); m === 11 ? (y++, (m = 0)) : m++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const r = map.get(key);
    out.push({
      month: key,
      label: monthLabel(y, m),
      collected: r?.collected ?? 0,
      count: r?.count ?? 0,
      cash: r?.cash ?? 0,
      bank: r?.bank ?? 0,
      online: r?.online ?? 0,
      billed: bmap.get(key) ?? 0,
    });
  }
  return out;
}

export async function dashboard(_req: Request, res: Response) {
  const now = new Date();
  const { year, month } = localParts(now);
  const monthStart = startOfLocalDay(`${year}-${String(month + 1).padStart(2, '0')}-01`);
  const [summary, totalStudents, activeStudents, monthCollected, chart, recentPayments, outstandingStudents, methodSplit] = await Promise.all([
    summarizeFees(null, now),
    Student.countDocuments({ deletedAt: null }),
    Student.countDocuments({ deletedAt: null, status: 'active' }),
    Payment.aggregate([{ $match: { paidAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    monthlyCollections(range({}, 6).from, now),
    Payment.find().sort({ paidAt: -1, _id: -1 }).limit(6).populate('student', 'fullName studentId').populate('feeRecord', 'title'),
    FeeRecord.aggregate([
      { $match: { status: { $in: ['pending', 'partial'] } } },
      {
        $group: {
          _id: '$student',
          outstanding: { $sum: { $subtract: ['$amount', '$amountPaid'] } },
          overdue: { $sum: { $cond: [{ $lt: ['$dueDate', now] }, { $subtract: ['$amount', '$amountPaid'] }, 0] } },
          oldestDue: { $min: '$dueDate' },
          count: { $sum: 1 },
        },
      },
      { $sort: { overdue: -1, outstanding: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $match: { 'student.deletedAt': null } },
      { $project: { outstanding: 1, overdue: 1, oldestDue: 1, count: 1, 'student._id': 1, 'student.fullName': 1, 'student.studentId': 1, 'student.course': 1, 'student.batch': 1 } },
    ]),
    Payment.aggregate([{ $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);
  const collectionRate = summary.totalFees ? Math.round((summary.totalPaid / summary.totalFees) * 1000) / 10 : 0;
  return ok(res, {
    stats: {
      totalStudents,
      activeStudents,
      totalCollected: summary.totalPaid,
      totalBilled: summary.totalFees,
      pendingAmount: summary.totalPending,
      overdueAmount: summary.totalOverdue,
      overdueCount: summary.overdueCount,
      collectedThisMonth: monthCollected[0]?.total ?? 0,
      paymentsThisMonth: monthCollected[0]?.count ?? 0,
      collectionRate,
    },
    monthly: chart,
    recentPayments,
    outstandingStudents,
    methodSplit,
  });
}

export async function collections(req: Request, res: Response) {
  const { from, to } = range(req.valid!.query, 12);
  const monthly = await monthlyCollections(from, to);
  const total = monthly.reduce((a, m) => a + m.collected, 0);
  const byCourse = await Payment.aggregate([
    { $match: { paidAt: { $gte: from, $lte: to } } },
    { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 's' } },
    { $unwind: '$s' },
    { $group: { _id: '$s.course', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ] as PipelineStage[]);
  return ok(res, { from, to, total, monthly, byCourse });
}

async function outstandingList(kind: 'outstanding' | 'overdue', q: { from?: string; to?: string }) {
  const now = new Date();
  const filter: FilterQuery<IFeeRecord> = statusFilter(kind, now);
  if (q.from || q.to) {
    const r: Record<string, Date> = {};
    if (q.from) r.$gte = startOfLocalDay(q.from);
    if (q.to) r.$lte = dueDateFromInput(q.to);
    filter.dueDate = { ...(filter.dueDate as object), ...r };
  }
  const items = await FeeRecord.find(filter).sort({ dueDate: 1 }).limit(1000).populate({ path: 'student', select: 'fullName studentId course batch parent deletedAt', populate: { path: 'parent', select: 'name phone email' } });
  const rows = items.map((f) => serializeFee(f, now));
  const total = rows.reduce((a, r) => a + r.balance, 0);
  return { items: rows, total, count: rows.length };
}

export async function pendingReport(req: Request, res: Response) {
  return ok(res, await outstandingList('outstanding', req.valid!.query));
}
export async function overdueReport(req: Request, res: Response) {
  return ok(res, await outstandingList('overdue', req.valid!.query));
}

const d = (x?: Date | null) => (x ? x.toISOString().slice(0, 10) : '');

export async function exportCsv(req: Request, res: Response) {
  const { type, ...q } = req.valid!.query;
  let csv: string;
  if (type === 'collections') {
    const { from, to } = range(q, 12);
    const monthly = await monthlyCollections(from, to);
    csv = toCSV(
      ['Month', 'Billed (INR)', 'Collected (INR)', 'Payments', 'Cash (INR)', 'Bank transfer (INR)', 'Online - manual (INR)'],
      monthly.map((m) => [m.month, paiseToRupeeString(m.billed), paiseToRupeeString(m.collected), m.count, paiseToRupeeString(m.cash), paiseToRupeeString(m.bank), paiseToRupeeString(m.online)]),
    );
  } else if (type === 'payments') {
    const { from, to } = range(q, 12);
    const items = await Payment.find({ paidAt: { $gte: from, $lte: to } }).sort({ paidAt: 1 }).populate('student', 'fullName studentId').populate('feeRecord', 'title').lean();
    csv = toCSV(
      ['Date', 'Transaction ID', 'Receipt', 'Student ID', 'Student', 'Fee', 'Method', 'Reference', 'Amount (INR)', 'Balance after (INR)'],
      items.map((p) => {
        const s = p.student as unknown as { fullName: string; studentId: string } | null;
        const f = p.feeRecord as unknown as { title: string } | null;
        return [d(p.paidAt), p.transactionId, p.receiptNumber, s?.studentId, s?.fullName, f?.title, p.method === 'online_manual' ? 'online (manual entry)' : p.method, p.reference, paiseToRupeeString(p.amount), paiseToRupeeString(p.balanceAfter)];
      }),
    );
  } else {
    const { items } = await outstandingList(type === 'pending' ? 'outstanding' : 'overdue', q);
    csv = toCSV(
      ['Student ID', 'Student', 'Course', 'Batch', 'Parent', 'Parent phone', 'Fee', 'Due date', 'Amount (INR)', 'Paid (INR)', 'Balance (INR)', 'Status', 'Days overdue'],
      items.map((r) => {
        const s = (r as unknown as { student: { studentId: string; fullName: string; course: string; batch: string; parent?: { name: string; phone?: string } } }).student;
        const f = r as unknown as { title: string; dueDate: Date; amount: number; amountPaid: number };
        return [s?.studentId, s?.fullName, s?.course, s?.batch, s?.parent?.name, s?.parent?.phone, f.title, d(f.dueDate), paiseToRupeeString(f.amount), paiseToRupeeString(f.amountPaid), paiseToRupeeString(r.balance), r.effectiveStatus, r.daysOverdue];
      }),
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}

export async function auditLogs(req: Request, res: Response) {
  const { page, limit, action, entityId } = req.valid!.query;
  const filter: Record<string, unknown> = {};
  if (action) filter.action = new RegExp(`^${escapeRegex(action)}`);
  if (entityId) filter.entityId = entityId;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name email role'),
    AuditLog.countDocuments(filter),
  ]);
  return ok(res, items, pageMeta(page, limit, total));
}
