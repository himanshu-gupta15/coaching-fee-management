import { Student } from '../models';
import { api, auth, loginAarav, loginAdmin, loginRajesh, loginSunita, setupDb, studentByName, teardownDb } from './helpers';

beforeAll(() => setupDb('rbac'));
afterAll(teardownDb);

describe('Role-based access control', () => {
  it('denies parents and students access to admin endpoints', async () => {
    const parent = await loginRajesh();
    const student = await loginAarav();
    for (const t of [parent, student]) {
      expect((await api().get('/api/students').set(auth(t))).status).toBe(403);
      expect((await api().get('/api/reports/dashboard').set(auth(t))).status).toBe(403);
      expect((await api().post('/api/payments').set(auth(t)).send({})).status).toBe(403);
      expect((await api().post('/api/fees/generate').set(auth(t)).send({ period: '2026-01' })).status).toBe(403);
      expect((await api().get('/api/reports/export?type=payments').set(auth(t))).status).toBe(403);
    }
  });

  it('ignores user-supplied role values when creating parents', async () => {
    const admin = await loginAdmin();
    const res = await api().post('/api/parents').set(auth(admin)).send({ name: 'Sneaky Person', email: 'sneaky@example.com', password: 'Passw0rd!', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('parent');
  });

  it('returns 401 for every protected module without a token', async () => {
    for (const path of ['/api/students', '/api/parents', '/api/fees/records', '/api/payments', '/api/notifications', '/api/announcements', '/api/reports/dashboard', '/api/users']) {
      expect((await api().get(path)).status).toBe(401);
    }
  });
});

describe('Parent access restrictions (IDOR)', () => {
  it('lets a parent view their own child', async () => {
    const t = await loginRajesh();
    const aarav = await studentByName('Aarav Sharma');
    const res = await api().get(`/api/students/${aarav!._id}`).set(auth(t));
    expect(res.status).toBe(200);
    expect(res.body.data.student.fullName).toBe('Aarav Sharma');
    expect(res.body.data.student.user).toBeUndefined();
  });

  it("blocks a parent from another parent's child, its fees, payments and receipts", async () => {
    const t = await loginSunita();
    const zara = await studentByName('Zara Khan');
    expect((await api().get(`/api/students/${zara!._id}`).set(auth(t))).status).toBe(404);
    expect((await api().get(`/api/fees/records?student=${zara!._id}`).set(auth(t))).status).toBe(404);
    expect((await api().get(`/api/payments?student=${zara!._id}`).set(auth(t))).status).toBe(404);

    const admin = await loginAdmin();
    const fees = await api().get(`/api/fees/records?student=${zara!._id}`).set(auth(admin));
    const pays = await api().get(`/api/payments?student=${zara!._id}`).set(auth(admin));
    expect((await api().get(`/api/fees/records/${fees.body.data[0]._id}`).set(auth(t))).status).toBe(404);
    expect((await api().get(`/api/payments/${pays.body.data[0]._id}`).set(auth(t))).status).toBe(404);
    expect((await api().get(`/api/payments/${pays.body.data[0]._id}/receipt`).set(auth(t))).status).toBe(404);
  });

  it("scopes list endpoints to the parent's own children", async () => {
    const t = await loginSunita();
    const rohan = await studentByName('Rohan Verma');
    const fees = await api().get('/api/fees/records?limit=100').set(auth(t));
    const pays = await api().get('/api/payments?limit=100').set(auth(t));
    expect(fees.body.data.length).toBeGreaterThan(0);
    expect(fees.body.data.every((f: { student: { _id: string } }) => f.student._id === String(rohan!._id))).toBe(true);
    expect(pays.body.data.every((p: { student: { _id: string } }) => p.student._id === String(rohan!._id))).toBe(true);
  });

  it('lets a student see only their own profile', async () => {
    const t = await loginAarav();
    const me = await api().get('/api/students/me').set(auth(t));
    expect(me.status).toBe(200);
    expect(me.body.data.student.fullName).toBe('Aarav Sharma');
    const ananya = await Student.findOne({ fullName: 'Ananya Sharma' });
    expect((await api().get(`/api/students/${ananya!._id}`).set(auth(t))).status).toBe(404);
  });

  it('rejects NoSQL operator injection in bodies', async () => {
    const res = await api().post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});
