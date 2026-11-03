import { Types, type FilterQuery } from 'mongoose';
import { FeeRecord, type EffectiveFeeStatus, type IFeeRecord } from '../models/FeeRecord';
import { FeeStructure, type FeeStructureDoc } from '../models/FeeStructure';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { daysInMonth, endOfLocalDay, fullMonthLabel, dueDateFromInput } from '../utils/dates';
import { notifyMany } from './notification.service';
import { formatINR } from '../utils/money';

type FeeLike = Pick<IFeeRecord, 'amount' | 'amountPaid' | 'dueDate' | 'status'>;

/** Single source of truth for a fee record's displayed status. */
export function effectiveStatus(fee: FeeLike, now = new Date()): EffectiveFeeStatus {
  if (fee.status === 'cancelled') return 'cancelled';
  if (fee.amountPaid >= fee.amount) return 'paid';
  if (fee.dueDate.getTime() < now.getTime()) return 'overdue';
  if (fee.amountPaid > 0) return 'partial';
  return 'pending';
}

export function balanceOf(fee: Pick<IFeeRecord, 'amount' | 'amountPaid' | 'status'>): number {
  if (fee.status === 'cancelled') return 0;
  return Math.max(0, fee.amount - fee.amountPaid);
}

export function serializeFee<T extends FeeLike & { toJSON?: () => unknown }>(fee: T, now = new Date()) {
  const base = (typeof fee.toJSON === 'function' ? fee.toJSON() : fee) as Record<string, unknown>;
  return {
    ...base,
    balance: balanceOf(fee),
    effectiveStatus: effectiveStatus(fee, now),
    daysOverdue:
      effectiveStatus(fee, now) === 'overdue'
        ? Math.floor((now.getTime() - fee.dueDate.getTime()) / 86_400_000) + 1
        : 0,
  };
}

/** Translate an effective status into a MongoDB filter. */
export function statusFilter(status: EffectiveFeeStatus | 'outstanding', now = new Date()): FilterQuery<IFeeRecord> {
  switch (status) {
    case 'paid':
      return { status: 'paid' };
    case 'cancelled':
      return { status: 'cancelled' };
    case 'overdue':
      return { status: { $in: ['pending', 'partial'] }, dueDate: { $lt: now } };
    case 'pending':
      return { status: 'pending', dueDate: { $gte: now } };
    case 'partial':
      return { status: 'partial', dueDate: { $gte: now } };
    case 'outstanding':
      return { status: { $in: ['pending', 'partial'] } };
  }
}

export interface FeeSummary {
  totalFees: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  overdueCount: number;
  pendingCount: number;
  nextDue: { _id: string; title: string; dueDate: Date; balance: number } | null;
}

/** Aggregated summary for a set of students (all amounts integer paise). */
export async function summarizeFees(studentIds: Types.ObjectId[] | null, now = new Date()): Promise<FeeSummary> {
  const match: FilterQuery<IFeeRecord> = { status: { $ne: 'cancelled' } };
  if (studentIds) match.student = { $in: studentIds };
  const [agg] = await FeeRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalFees: { $sum: '$amount' },
        totalPaid: { $sum: '$amountPaid' },
        totalPending: { $sum: { $subtract: ['$amount', '$amountPaid'] } },
        totalOverdue: {
          $sum: {
            $cond: [
              { $and: [{ $lt: ['$dueDate', now] }, { $lt: ['$amountPaid', '$amount'] }] },
              { $subtract: ['$amount', '$amountPaid'] },
              0,
            ],
          },
        },
        overdueCount: {
          $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', now] }, { $lt: ['$amountPaid', '$amount'] }] }, 1, 0] },
        },
        pendingCount: { $sum: { $cond: [{ $lt: ['$amountPaid', '$amount'] }, 1, 0] } },
      },
    },
  ]);
  const nextDueQuery: FilterQuery<IFeeRecord> = { status: { $in: ['pending', 'partial'] }, dueDate: { $gte: now } };
  if (studentIds) nextDueQuery.student = { $in: studentIds };
  const next = await FeeRecord.findOne(nextDueQuery).sort({ dueDate: 1 }).lean();
  return {
    totalFees: agg?.totalFees ?? 0,
    totalPaid: agg?.totalPaid ?? 0,
    totalPending: agg?.totalPending ?? 0,
    totalOverdue: agg?.totalOverdue ?? 0,
    overdueCount: agg?.overdueCount ?? 0,
    pendingCount: agg?.pendingCount ?? 0,
    nextDue: next
      ? { _id: String(next._id), title: next.title, dueDate: next.dueDate, balance: next.amount - next.amountPaid }
      : null,
  };
}

/** Parse "YYYY-MM" into a period descriptor for a given fee structure. */
export function periodFor(structure: FeeStructureDoc, period: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) throw AppError.badRequest('Period must be in YYYY-MM format');
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) throw AppError.badRequest('Invalid month');
  const dueDay = Math.min(structure.dueDay, daysInMonth(year, month));
  const dueDate = endOfLocalDay(year, month, dueDay);
  if (structure.frequency === 'monthly') {
    return { periodKey: `${year}-${m[2]}`, title: `${structure.name} — ${fullMonthLabel(year, month)}`, dueDate };
  }
  if (structure.frequency === 'quarterly') {
    // Indian academic quarters start in Apr, Jul, Oct, Jan.
    const q = Math.floor(((month + 9) % 12) / 3) + 1;
    const fy = month >= 3 ? year : year - 1;
    return { periodKey: `FY${fy}-Q${q}`, title: `${structure.name} — Q${q} FY${fy}-${String((fy + 1) % 100).padStart(2, '0')}`, dueDate };
  }
  return { periodKey: 'ONE_TIME', title: structure.name, dueDate };
}

interface GenerateInput {
  period: string;
  feeStructureId?: string;
  studentIds?: string[];
  dueDate?: string;
  createdBy: Types.ObjectId;
}

/**
 * Generates fee records for active students on a fee plan. Idempotent: the unique
 * (student, feeStructure, periodKey) index means re-running never duplicates fees.
 * For quarterly plans, generating any month in a quarter creates that quarter's record once.
 */
export async function generateFeeRecords(input: GenerateInput) {
  const studentFilter: FilterQuery<unknown> = { status: 'active', deletedAt: null, feePlan: { $ne: null } };
  if (input.feeStructureId) studentFilter.feePlan = new Types.ObjectId(input.feeStructureId);
  if (input.studentIds?.length) studentFilter._id = { $in: input.studentIds.map((id) => new Types.ObjectId(id)) };

  const students = await Student.find(studentFilter).lean();
  const structureIds = [...new Set(students.map((s) => String(s.feePlan)))];
  const structures = await FeeStructure.find({ _id: { $in: structureIds }, isActive: true });
  const byId = new Map(structures.map((s) => [String(s._id), s]));

  let created = 0;
  let skipped = 0;
  const createdRecords: { student: (typeof students)[number]; title: string; amount: number; dueDate: Date; id: Types.ObjectId }[] = [];

  for (const student of students) {
    const structure = byId.get(String(student.feePlan));
    if (!structure) {
      skipped++;
      continue;
    }
    const p = periodFor(structure, input.period);
    const dueDate = input.dueDate ? dueDateFromInput(input.dueDate) : p.dueDate;
    const res = await FeeRecord.updateOne(
      { student: student._id, feeStructure: structure._id, periodKey: p.periodKey },
      {
        $setOnInsert: {
          title: p.title,
          amount: structure.amount,
          amountPaid: 0,
          dueDate,
          status: 'pending',
          createdBy: input.createdBy,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) {
      created++;
      createdRecords.push({ student, title: p.title, amount: structure.amount, dueDate, id: res.upsertedId as Types.ObjectId });
    } else skipped++;
  }

  // In-app "fee due" notifications to parent and student accounts.
  const notes = createdRecords.flatMap((r) => {
    const recipients = [r.student.parent, r.student.user].filter(Boolean) as Types.ObjectId[];
    return recipients.map((user) => ({
      user,
      type: 'fee_due' as const,
      title: 'New fee due',
      message: `${r.title} of ${formatINR(r.amount)} for ${r.student.fullName} is due on ${r.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}.`,
      link: `/fees/${r.id}`,
      dedupeKey: `due-created:${r.id}`,
    }));
  });
  await notifyMany(notes);

  return { created, skipped, studentsConsidered: students.length };
}

export async function parentAndStudentUsers(studentId: Types.ObjectId) {
  const s = await Student.findById(studentId).select('parent user fullName').lean();
  if (!s) return { recipients: [] as Types.ObjectId[], student: null };
  const ids = [s.parent, s.user].filter(Boolean) as Types.ObjectId[];
  const active = await User.find({ _id: { $in: ids }, isActive: true }).select('_id').lean();
  return { recipients: active.map((u) => u._id), student: s };
}
