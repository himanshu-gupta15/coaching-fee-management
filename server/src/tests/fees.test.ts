import { FeeRecord, FeeStructure, Student } from '../models';
import { effectiveStatus, balanceOf } from '../services/fee.service';
import { api, auth, loginAdmin, setupDb, teardownDb } from './helpers';

beforeAll(() => setupDb('fees'));
afterAll(teardownDb);

describe('Fee generation', () => {
  it('generates monthly records once per student and is idempotent', async () => {
    const t = await loginAdmin();
    const first = await api().post('/api/fees/generate').set(auth(t)).send({ period: '2030-01' });
    expect(first.status).toBe(200);
    expect(first.body.data.created).toBe(5);
    const again = await api().post('/api/fees/generate').set(auth(t)).send({ period: '2030-01' });
    expect(again.body.data.created).toBe(0);
    expect(again.body.data.skipped).toBe(5);
    const recs = await FeeRecord.find({ periodKey: '2030-01' });
    expect(recs).toHaveLength(5);
    const jee = await FeeStructure.findOne({ name: /JEE/ });
    const jeeRec = recs.find((r) => String(r.feeStructure) === String(jee!._id))!;
    expect(jeeRec.amount).toBe(650000);
    expect(jeeRec.amountPaid).toBe(0);
    expect(jeeRec.status).toBe('pending');
    expect(jeeRec.dueDate.toISOString()).toBe('2030-01-10T18:29:59.999Z'); // end of 10 Jan IST
  });

  it('generates quarterly fees once per quarter', async () => {
    const t = await loginAdmin();
    const ts = await FeeStructure.findOne({ frequency: 'quarterly' });
    const s = await Student.findOne({ fullName: 'Aarav Sharma' });
    s!.feePlan = ts!._id;
    await s!.save();
    const a = await api().post('/api/fees/generate').set(auth(t)).send({ period: '2030-04', studentIds: [String(s!._id)] });
    const b = await api().post('/api/fees/generate').set(auth(t)).send({ period: '2030-05', studentIds: [String(s!._id)] });
    expect(a.body.data.created).toBe(1);
    expect(b.body.data.created).toBe(0);
    const rec = await FeeRecord.findOne({ student: s!._id, feeStructure: ts!._id, periodKey: 'FY2030-Q1' });
    expect(rec).toBeTruthy();
  });

  it('creates fee-due notifications for parent and student', async () => {
    const t = await loginAdmin();
    const parent = (await api().post('/api/auth/login').send({ email: 'rajesh.sharma@example.com', password: 'Parent@123' })).body.data.token;
    await api().post('/api/fees/generate').set(auth(t)).send({ period: '2030-02' });
    const n = await api().get('/api/notifications?limit=50').set(auth(parent));
    expect(n.body.data.some((x: { type: string; message: string }) => x.type === 'fee_due' && x.message.includes('February 2030'))).toBe(true);
  });
});

describe('Overdue calculations', () => {
  const due = new Date('2026-06-10T18:29:59.999Z');
  it('is overdue only after the due date with a remaining balance', () => {
    expect(effectiveStatus({ amount: 1000, amountPaid: 0, dueDate: due, status: 'pending' }, new Date('2026-06-10T12:00:00Z'))).toBe('pending');
    expect(effectiveStatus({ amount: 1000, amountPaid: 0, dueDate: due, status: 'pending' }, new Date('2026-06-11T00:00:00Z'))).toBe('overdue');
    expect(effectiveStatus({ amount: 1000, amountPaid: 400, dueDate: due, status: 'partial' }, new Date('2026-06-11T00:00:00Z'))).toBe('overdue');
    expect(effectiveStatus({ amount: 1000, amountPaid: 400, dueDate: due, status: 'partial' }, new Date('2026-06-01'))).toBe('partial');
    expect(effectiveStatus({ amount: 1000, amountPaid: 1000, dueDate: due, status: 'paid' }, new Date('2027-01-01'))).toBe('paid');
    expect(effectiveStatus({ amount: 1000, amountPaid: 0, dueDate: due, status: 'cancelled' }, new Date('2027-01-01'))).toBe('cancelled');
    expect(balanceOf({ amount: 1000, amountPaid: 400, status: 'partial' })).toBe(600);
  });

  it('filters overdue records via the API and reports overdue totals', async () => {
    const t = await loginAdmin();
    const res = await api().get('/api/fees/records?status=overdue&limit=100').set(auth(t));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const f of res.body.data) {
      expect(f.effectiveStatus).toBe('overdue');
      expect(new Date(f.dueDate).getTime()).toBeLessThan(Date.now());
      expect(f.balance).toBeGreaterThan(0);
    }
    const report = await api().get('/api/reports/overdue').set(auth(t));
    const sum = res.body.data.reduce((a: number, f: { balance: number }) => a + f.balance, 0);
    expect(report.body.data.total).toBe(sum);
  });

  it('prevents lowering a fee below the amount already paid', async () => {
    const t = await loginAdmin();
    const partial = await FeeRecord.findOne({ status: 'partial' });
    const res = await api().patch(`/api/fees/records/${partial!._id}`).set(auth(t)).send({ amount: partial!.amountPaid - 100 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('AMOUNT_BELOW_PAID');
  });

  it('refuses to cancel a fee that has payments', async () => {
    const t = await loginAdmin();
    const paid = await FeeRecord.findOne({ status: 'paid' });
    const res = await api().post(`/api/fees/records/${paid!._id}/cancel`).set(auth(t)).send({ reason: 'test cancel' });
    expect(res.status).toBe(422);
  });
});
