import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Announcement, AuditLog, FeeRecord, FeeStructure, Notification, Payment, Student, User } from '../models';
import type { PaymentMethod } from '../models/Payment';
import { daysInMonth, endOfLocalDay, fullMonthLabel, localParts } from '../utils/dates';
import { generateReceiptNumber, generateTransactionId } from '../utils/ids';
import { runFeeReminders } from '../services/notification.service';
import { formatINR } from '../utils/money';

export const DEMO_CREDENTIALS = {
  admin: { email: 'admin@brightpath.edu', password: 'Admin@123' },
  parents: [
    { email: 'rajesh.sharma@example.com', password: 'Parent@123' },
    { email: 'sunita.verma@example.com', password: 'Parent@123' },
    { email: 'imran.khan@example.com', password: 'Parent@123' },
  ],
  students: [
    { email: 'aarav.sharma@student.example.com', password: 'Student@123' },
    { email: 'ananya.sharma@student.example.com', password: 'Student@123' },
    { email: 'rohan.verma@student.example.com', password: 'Student@123' },
    { email: 'zara.khan@student.example.com', password: 'Student@123' },
    { email: 'kabir.khan@student.example.com', password: 'Student@123' },
  ],
};

const rupees = (r: number) => r * 100;
const DAY = 86_400_000;

/**
 * Wipes and re-creates demo data. Dates are relative to "now" so the demo always
 * contains recent payments, upcoming deadlines, partial payments and overdue fees.
 */
export async function seedDatabase({ log = true, rounds = 10 }: { log?: boolean; rounds?: number } = {}) {
  const say = (...a: unknown[]) => log && console.log(...a);
  await Promise.all([
    User.deleteMany({}), Student.deleteMany({}), FeeStructure.deleteMany({}), FeeRecord.deleteMany({}),
    Payment.deleteMany({}), Notification.deleteMany({}), Announcement.deleteMany({}), AuditLog.deleteMany({}),
  ]);
  await Promise.all([User, Student, FeeStructure, FeeRecord, Payment, Notification, Announcement, AuditLog].map((m) => m.syncIndexes()));

  const hash = (p: string) => bcrypt.hash(p, rounds);
  const [adminHash, parentHash, studentHash] = await Promise.all([hash('Admin@123'), hash('Parent@123'), hash('Student@123')]);

  const admin = await User.create({ name: 'Priya Menon', email: DEMO_CREDENTIALS.admin.email, phone: '+91 98450 10001', passwordHash: adminHash, role: 'admin' });
  const [rajesh, sunita, imran] = await User.create([
    { name: 'Rajesh Sharma', email: 'rajesh.sharma@example.com', phone: '+91 98200 11111', passwordHash: parentHash, role: 'parent', createdBy: admin._id },
    { name: 'Sunita Verma', email: 'sunita.verma@example.com', phone: '+91 98200 22222', passwordHash: parentHash, role: 'parent', createdBy: admin._id },
    { name: 'Imran Khan', email: 'imran.khan@example.com', phone: '+91 98200 33333', passwordHash: parentHash, role: 'parent', createdBy: admin._id },
  ]);

  const [jee, neet, foundation, testSeries] = await FeeStructure.create([
    { name: 'JEE Main + Advanced (Monthly)', course: 'JEE Main + Advanced', frequency: 'monthly', amount: rupees(6500), dueDay: 10, description: 'Two-year classroom programme for IIT-JEE aspirants.' },
    { name: 'NEET UG (Monthly)', course: 'NEET UG', frequency: 'monthly', amount: rupees(7000), dueDay: 10, description: 'Medical entrance coaching with weekly mock tests.' },
    { name: 'Foundation Class 9-10 (Monthly)', course: 'Foundation (Class 9-10)', frequency: 'monthly', amount: rupees(3500), dueDay: 5, description: 'Maths & science foundation with olympiad prep.' },
    { name: 'All-India Test Series (Quarterly)', course: 'Test Series', frequency: 'quarterly', amount: rupees(4500), dueDay: 15, description: 'Optional quarterly mock-test package.' },
  ]);
  await FeeStructure.create({ name: 'Crash Course (One-time)', course: 'Crash Course', frequency: 'one_time', amount: rupees(12000), dueDay: 1, description: '6-week revision crash course.', isActive: true });

  const now = new Date();
  const { year: cy, month: cm } = localParts(now);
  const monthAt = (offset: number) => {
    const d = new Date(Date.UTC(cy, cm + offset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  };
  const admitted = monthAt(-6);

  type Spec = {
    name: string; email: string; phone: string; course: string; batch: string; parent: Types.ObjectId; plan: typeof jee;
    // per month (oldest -> current): list of [percentOfFee, method, daysRelativeToDue]
    months: [number, PaymentMethod, number][][];
    admission: [number, PaymentMethod][];
  };
  const full = (m: PaymentMethod, d = -2): [number, PaymentMethod, number][] => [[100, m, d]];
  const specs: Spec[] = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@student.example.com', phone: '+91 90000 10001', course: 'JEE Main + Advanced', batch: 'JEE-2027 Morning', parent: rajesh._id, plan: jee,
      months: [full('bank_transfer'), full('bank_transfer', -1), full('cash', 0), full('bank_transfer', -3), full('online_manual', -1), []],
      admission: [[100, 'bank_transfer']] },
    { name: 'Ananya Sharma', email: 'ananya.sharma@student.example.com', phone: '+91 90000 10002', course: 'Foundation (Class 9-10)', batch: 'Foundation-A Evening', parent: rajesh._id, plan: foundation,
      months: [full('cash'), full('cash', 1), full('cash', -1), full('bank_transfer', 3), [[40, 'cash', 2]], []],
      admission: [[100, 'cash']] },
    { name: 'Rohan Verma', email: 'rohan.verma@student.example.com', phone: '+91 90000 10003', course: 'NEET UG', batch: 'NEET-2027 Weekend', parent: sunita._id, plan: neet,
      months: [full('online_manual'), full('online_manual', 4), [[50, 'cash', 6], [50, 'cash', 18]], [], [], []],
      admission: [[60, 'cash']] },
    { name: 'Zara Khan', email: 'zara.khan@student.example.com', phone: '+91 90000 10004', course: 'JEE Main + Advanced', batch: 'JEE-2027 Evening', parent: imran._id, plan: jee,
      months: [full('bank_transfer', -5), full('bank_transfer', -4), full('bank_transfer', -6), full('bank_transfer', -2), [], [[100, 'bank_transfer', -8]]],
      admission: [[100, 'bank_transfer']] },
    { name: 'Kabir Khan', email: 'kabir.khan@student.example.com', phone: '+91 90000 10005', course: 'Foundation (Class 9-10)', batch: 'Foundation-B Morning', parent: imran._id, plan: foundation,
      months: [full('cash', 0), full('cash', -1), full('cash', 2), full('cash', -2), [[50, 'cash', -1], [50, 'cash', 9]], [[40, 'cash', -3]]],
      admission: [[100, 'cash']] },
  ];

  let paymentCount = 0;
  let feeCount = 0;
  let refSeq = 1000;

  const pay = async (fee: InstanceType<typeof FeeRecord>, amount: number, method: PaymentMethod, when: Date, studentName: string) => {
    const paidAt = new Date(Math.min(when.getTime(), now.getTime() - 3600_000));
    fee.amountPaid += amount;
    fee.status = fee.amountPaid >= fee.amount ? 'paid' : 'partial';
    if (fee.status === 'paid') fee.paidAt = paidAt;
    await fee.save();
    refSeq++;
    await Payment.create({
      transactionId: generateTransactionId(paidAt),
      receiptNumber: generateReceiptNumber(paidAt),
      feeRecord: fee._id,
      student: fee.student,
      amount,
      method,
      reference: method === 'cash' ? undefined : method === 'bank_transfer' ? `UTR${String(410000 + refSeq)}${refSeq}` : `UPI-DEMO-${refSeq}`,
      paidAt,
      recordedBy: admin._id,
      notes: method === 'online_manual' ? 'Demo: parent shared UPI screenshot; recorded manually by office.' : undefined,
      idempotencyKey: `seed-${fee._id}-${fee.amountPaid}`,
      manualEntry: true,
      balanceAfter: fee.amount - fee.amountPaid,
    });
    await AuditLog.create({ actor: admin._id, actorRole: 'admin', action: 'payment.recorded', entityType: 'Payment', summary: `Recorded ${formatINR(amount)} (${method}) for ${studentName} — ${fee.title}`, metadata: { seed: true } });
    paymentCount++;
  };

  let seq = 1;
  for (const spec of specs) {
    const user = await User.create({ name: spec.name, email: spec.email, phone: spec.phone, passwordHash: studentHash, role: 'student', createdBy: admin._id });
    const student = await Student.create({
      studentId: `STU-${admitted.year}-${String(seq++).padStart(4, '0')}`,
      fullName: spec.name, email: spec.email, phone: spec.phone, course: spec.course, batch: spec.batch,
      admissionDate: new Date(Date.UTC(admitted.year, admitted.month, 3 + seq)),
      parent: spec.parent, user: user._id, feePlan: spec.plan._id, status: 'active',
    });

    // One-time admission / study material fee
    const admDue = endOfLocalDay(admitted.year, admitted.month, 15);
    const adm = await FeeRecord.create({
      student: student._id, feeStructure: null, title: 'Admission & Study Material Kit', periodKey: `CUSTOM-ADM-${student._id}`,
      amount: rupees(5000), amountPaid: 0, dueDate: admDue, status: 'pending', createdBy: admin._id,
    });
    feeCount++;
    for (const [pct, method] of spec.admission) await pay(adm, Math.round((rupees(5000) * pct) / 100), method, new Date(admDue.getTime() - 5 * DAY), spec.name);

    for (let i = 0; i < spec.months.length; i++) {
      const { year, month } = monthAt(i - (spec.months.length - 1));
      const dueDate = endOfLocalDay(year, month, Math.min(spec.plan.dueDay, daysInMonth(year, month)));
      const fee = await FeeRecord.create({
        student: student._id, feeStructure: spec.plan._id, title: `${spec.plan.name} — ${fullMonthLabel(year, month)}`,
        periodKey: `${year}-${String(month + 1).padStart(2, '0')}`, amount: spec.plan.amount, amountPaid: 0, dueDate, status: 'pending', createdBy: admin._id,
      });
      feeCount++;
      for (const [pct, method, days] of spec.months[i]) {
        await pay(fee, Math.round((spec.plan.amount * pct) / 100), method, new Date(dueDate.getTime() + days * DAY - 8 * 3600_000), spec.name);
      }
    }
  }

  // Enrol Zara in the optional quarterly test series too (current quarter, unpaid).
  const zara = await Student.findOne({ fullName: 'Zara Khan' });
  const tsDue = endOfLocalDay(monthAt(1).year, monthAt(1).month, 15);
  await FeeRecord.create({ student: zara!._id, feeStructure: testSeries._id, title: 'All-India Test Series — Current Quarter', periodKey: 'SEED-Q', amount: testSeries.amount, amountPaid: 0, dueDate: tsDue, status: 'pending', createdBy: admin._id });
  feeCount++;

  const ann = await Announcement.create([
    { title: 'Diwali break: 30 Oct – 3 Nov', body: 'The institute remains closed for Diwali. Regular classes resume after the break. Online doubt-clearing sessions continue on the student portal.', audience: 'all', pinned: true, createdBy: admin._id },
    { title: 'Monthly fee due by the 10th', body: 'Monthly tuition fees are due by the 10th of every month (5th for Foundation batches). Payments can be made at the front office in cash, or by bank transfer — please share the UTR with the office so it can be recorded.', audience: 'parents', createdBy: admin._id },
    { title: 'All-India Mock Test #4 this Sunday', body: 'Full-syllabus mock test for JEE and NEET batches on Sunday, 9:00 AM. Carry your admit card and two pencils.', audience: 'students', createdBy: admin._id },
  ]);
  const everyone = await User.find({ role: { $in: ['parent', 'student'] } }).lean();
  await Notification.insertMany(
    ann.flatMap((a) => everyone
      .filter((u) => a.audience === 'all' || (a.audience === 'parents' ? u.role === 'parent' : u.role === 'student'))
      .map((u) => ({ user: u._id, type: 'announcement', title: a.title, message: a.body.slice(0, 180), link: '/announcements', dedupeKey: `announcement:${a._id}`, read: a.pinned }))),
  );

  // Payment-success notifications for the most recent payments
  const recent = await Payment.find().sort({ paidAt: -1 }).limit(6).populate('student').populate('feeRecord');
  for (const p of recent) {
    const s = p.student as unknown as { fullName: string; parent?: Types.ObjectId; user?: Types.ObjectId };
    const f = p.feeRecord as unknown as { title: string };
    for (const u of [s.parent, s.user].filter(Boolean) as Types.ObjectId[]) {
      await Notification.create({ user: u, type: 'payment_success', title: 'Payment received', message: `${formatINR(p.amount)} received for ${s.fullName} — ${f.title}. Receipt ${p.receiptNumber}.`, link: `/payments/${p._id}`, dedupeKey: `payment:${p._id}` });
    }
  }
  const reminders = await runFeeReminders(now);
  await AuditLog.create({ actor: null, actorRole: 'system', action: 'system.seeded', entityType: 'System', summary: 'Demo data seeded' });

  say(`Seeded: 1 admin, 3 parents, ${specs.length} students, ${feeCount} fee records, ${paymentCount} payments, reminders: ${JSON.stringify(reminders)}`);
  return { feeCount, paymentCount };
}
