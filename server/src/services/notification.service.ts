import { Types } from 'mongoose';
import { Notification, type NotificationType } from '../models/Notification';
import { FeeRecord } from '../models/FeeRecord';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { env } from '../config/env';
import { formatINR } from '../utils/money';
import { localParts } from '../utils/dates';

export interface NotifyInput {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
}

/** Inserts notifications, silently skipping duplicates (same user + dedupeKey). */
export async function notifyMany(items: NotifyInput[]): Promise<number> {
  if (!items.length) return 0;
  try {
    const res = await Notification.insertMany(items, { ordered: false });
    return res.length;
  } catch (err: unknown) {
    const e = err as { code?: number; insertedDocs?: unknown[]; writeErrors?: { code?: number; err?: { code?: number } }[] };
    const allDupes = (e.writeErrors ?? []).every((w) => (w.code ?? w.err?.code) === 11000);
    if (e.code === 11000 || allDupes) return e.insertedDocs?.length ?? 0;
    throw err;
  }
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/**
 * Creates "due soon" and "overdue" reminders for parents and students.
 * Safe to run repeatedly: due-soon reminders are sent once per fee, overdue
 * reminders at most once per fee per local day.
 */
export async function runFeeReminders(now = new Date()) {
  const soon = new Date(now.getTime() + env.REMINDER_DAYS_BEFORE_DUE * 86_400_000);
  const { year, month, day } = localParts(now);
  const today = `${year}-${month + 1}-${day}`;

  const fees = await FeeRecord.find({ status: { $in: ['pending', 'partial'] }, dueDate: { $lte: soon } }).lean();
  if (!fees.length) return { dueSoon: 0, overdue: 0 };

  const students = await Student.find({ _id: { $in: fees.map((f) => f.student) }, deletedAt: null, status: 'active' })
    .select('fullName parent user')
    .lean();
  const sMap = new Map(students.map((s) => [String(s._id), s]));
  const userIds = students.flatMap((s) => [s.parent, s.user]).filter(Boolean) as Types.ObjectId[];
  const activeUsers = new Set((await User.find({ _id: { $in: userIds }, isActive: true }).select('_id').lean()).map((u) => String(u._id)));

  const items: NotifyInput[] = [];
  let dueSoon = 0;
  let overdue = 0;
  for (const f of fees) {
    const s = sMap.get(String(f.student));
    if (!s) continue;
    const balance = f.amount - f.amountPaid;
    const isOverdue = f.dueDate < now;
    const recipients = [s.parent, s.user].filter((u) => u && activeUsers.has(String(u))) as Types.ObjectId[];
    for (const user of recipients) {
      if (isOverdue) {
        overdue++;
        items.push({
          user,
          type: 'fee_overdue',
          title: 'Fee overdue',
          message: `${f.title} for ${s.fullName} was due on ${fmtDate(f.dueDate)}. Outstanding: ${formatINR(balance)}.`,
          link: `/fees/${f._id}`,
          dedupeKey: `overdue:${f._id}:${today}`,
        });
      } else {
        dueSoon++;
        items.push({
          user,
          type: 'fee_due',
          title: 'Fee due soon',
          message: `${f.title} for ${s.fullName} is due on ${fmtDate(f.dueDate)}. Amount due: ${formatINR(balance)}.`,
          link: `/fees/${f._id}`,
          dedupeKey: `due-soon:${f._id}`,
        });
      }
    }
  }
  const inserted = await notifyMany(items);
  return { dueSoon, overdue, inserted };
}
