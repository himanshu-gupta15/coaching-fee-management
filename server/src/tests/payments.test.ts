import { AuditLog, FeeRecord, Payment, Student } from '../models';
import { api, auth, key, loginAdmin, loginRajesh, setupDb, teardownDb } from './helpers';

beforeAll(() => setupDb('payments'));
afterAll(teardownDb);

async function freshFee(amount = 600000) {
  const t = await loginAdmin();
  const s = await Student.findOne({ fullName: 'Aarav Sharma' });
  const res = await api().post('/api/fees/records').set(auth(t)).send({ studentId: String(s!._id), title: `Test fee ${key()}`, amount, dueDate: '2099-01-10' });
  expect(res.status).toBe(201);
  return { t, fee: res.body.data };
}

describe('Partial payments and balances', () => {
  it('handles multiple partial payments and marks paid only at zero balance', async () => {
    const { t, fee } = await freshFee(600000);
    const p1 = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 250050, method: 'cash', idempotencyKey: key() });
    expect(p1.status).toBe(201);
    expect(p1.body.data.fee).toMatchObject({ amountPaid: 250050, balance: 349950, status: 'partial' });
    expect(p1.body.data.payment.balanceAfter).toBe(349950);
    expect(p1.body.data.payment.transactionId).toMatch(/^TXN-\d{8}-[A-Z0-9]{8}$/);

    const p2 = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 349949, method: 'bank_transfer', reference: `UTR-${key()}`, idempotencyKey: key() });
    expect(p2.body.data.fee.status).toBe('partial');
    expect(p2.body.data.fee.balance).toBe(1);

    const p3 = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1, method: 'cash', idempotencyKey: key() });
    expect(p3.body.data.fee).toMatchObject({ status: 'paid', balance: 0 });

    const stored = await FeeRecord.findById(fee._id);
    const sum = (await Payment.find({ feeRecord: fee._id })).reduce((a, p) => a + p.amount, 0);
    expect(stored!.amountPaid).toBe(sum);
    expect(stored!.status).toBe('paid');
    expect(stored!.paidAt).toBeTruthy();
  });

  it('rejects payments that exceed the outstanding balance', async () => {
    const { t, fee } = await freshFee(100000);
    await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 60000, method: 'cash', idempotencyKey: key() });
    const over = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 40001, method: 'cash', idempotencyKey: key() });
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe('OVERPAYMENT');
    expect(over.body.error.details.outstanding).toBe(40000);
  });

  it('rejects non-integer, zero and negative amounts', async () => {
    const { t, fee } = await freshFee();
    for (const amount of [0, -100, 10.5, '100']) {
      const r = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount, method: 'cash', idempotencyKey: key() });
      expect(r.status).toBe(400);
    }
  });

  it('rejects payment on a fully paid fee', async () => {
    const { t, fee } = await freshFee(5000);
    await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 5000, method: 'cash', idempotencyKey: key() });
    const r = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1, method: 'cash', idempotencyKey: key() });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('ALREADY_PAID');
  });
});

describe('Duplicate payment prevention', () => {
  it('rejects a re-submitted idempotency key', async () => {
    const { t, fee } = await freshFee();
    const k = key();
    const a = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1000, method: 'cash', idempotencyKey: k });
    const b = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1000, method: 'cash', idempotencyKey: k });
    expect(a.status).toBe(201);
    expect(b.status).toBe(409);
    expect(await Payment.countDocuments({ feeRecord: fee._id })).toBe(1);
  });

  it('rejects a reused bank reference', async () => {
    const { t, fee } = await freshFee();
    const ref = `UTR-${key()}`;
    await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1000, method: 'bank_transfer', reference: ref, idempotencyKey: key() });
    const dup = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1000, method: 'bank_transfer', reference: ref, idempotencyKey: key() });
    expect(dup.status).toBe(409);
  });

  it('never over-collects under concurrent submissions', async () => {
    const { t, fee } = await freshFee(100000);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 30000, method: 'cash', idempotencyKey: key() })),
    );
    const okCount = results.filter((r) => r.status === 201).length;
    expect(okCount).toBe(3);
    const stored = await FeeRecord.findById(fee._id);
    expect(stored!.amountPaid).toBe(90000);
    expect(stored!.amountPaid).toBeLessThanOrEqual(stored!.amount);
  });

  it('requires a reference for bank and online payments', async () => {
    const { t, fee } = await freshFee();
    const r = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1000, method: 'online_manual', idempotencyKey: key() });
    expect(r.status).toBe(400);
  });

  it('writes an audit log entry for every payment', async () => {
    const { t, fee } = await freshFee();
    const r = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 1234, method: 'cash', idempotencyKey: key() });
    const log = await AuditLog.findOne({ action: 'payment.recorded', entityId: r.body.data.payment._id });
    expect(log).toBeTruthy();
    expect(log!.metadata).toMatchObject({ amount: 1234 });
  });
});

describe('Receipts', () => {
  it('generates a PDF receipt for admin and the linked parent', async () => {
    const { t, fee } = await freshFee();
    const r = await api().post('/api/payments').set(auth(t)).send({ feeRecordId: fee._id, amount: 5000, method: 'online_manual', reference: `UPI-${key()}`, idempotencyKey: key() });
    const id = r.body.data.payment._id;
    const adminPdf = await api().get(`/api/payments/${id}/receipt`).set(auth(t)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(adminPdf.status).toBe(200);
    expect(adminPdf.headers['content-type']).toBe('application/pdf');
    expect((adminPdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(adminPdf.headers['content-disposition']).toContain(r.body.data.payment.receiptNumber);

    const parent = await loginRajesh(); // Aarav's parent
    const parentPdf = await api().get(`/api/payments/${id}/receipt`).set(auth(parent));
    expect(parentPdf.status).toBe(200);
  });

  it('labels online payments as manual entries', async () => {
    const p = await Payment.findOne({ method: 'online_manual' });
    expect(p!.manualEntry).toBe(true);
  });
});
