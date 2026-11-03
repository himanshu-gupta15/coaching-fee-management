import { FeeRecord, Payment, User } from '../models';
import { api, auth, loginAdmin, setupDb, studentByName, teardownDb } from './helpers';

beforeAll(() => setupDb('students'));
afterAll(teardownDb);

describe('Student management', () => {
  it('creates a student with an auto-generated ID and optional login', async () => {
    const t = await loginAdmin();
    const parent = await User.findOne({ email: 'sunita.verma@example.com' });
    const res = await api().post('/api/students').set(auth(t)).send({
      fullName: 'Meera Iyer', email: 'meera.iyer@student.example.com', phone: '+91 90000 20001',
      course: 'NEET UG', batch: 'NEET-2027 Weekend', admissionDate: '2026-07-01', parent: String(parent!._id),
      createLogin: true, loginPassword: 'Student@123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.studentId).toMatch(/^STU-\d{4}-\d{4}$/);
    const login = await api().post('/api/auth/login').send({ email: 'meera.iyer@student.example.com', password: 'Student@123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('student');
  });

  it('validates required fields', async () => {
    const t = await loginAdmin();
    const res = await api().post('/api/students').set(auth(t)).send({ fullName: 'X', email: 'bad' });
    expect(res.status).toBe(400);
  });

  it('searches and filters students', async () => {
    const t = await loginAdmin();
    const s = await api().get('/api/students?search=khan').set(auth(t));
    expect(s.body.data.map((x: { fullName: string }) => x.fullName).sort()).toEqual(['Kabir Khan', 'Zara Khan']);
    const overdue = await api().get('/api/students?feeStatus=overdue').set(auth(t));
    expect(overdue.body.data.map((x: { fullName: string }) => x.fullName)).toContain('Rohan Verma');
    expect(overdue.body.data.map((x: { fullName: string }) => x.fullName)).not.toContain('Aarav Sharma');
  });

  it('archives a student without losing payment history', async () => {
    const t = await loginAdmin();
    const kabir = await studentByName('Kabir Khan');
    const before = await Payment.countDocuments({ student: kabir!._id });
    const res = await api().delete(`/api/students/${kabir!._id}`).set(auth(t));
    expect(res.status).toBe(200);
    expect(await Payment.countDocuments({ student: kabir!._id })).toBe(before);
    expect(await FeeRecord.countDocuments({ student: kabir!._id })).toBeGreaterThan(0);
    const list = await api().get('/api/students?search=kabir').set(auth(t));
    expect(list.body.data).toHaveLength(0);
    const login = await api().post('/api/auth/login').send({ email: 'kabir.khan@student.example.com', password: 'Student@123' });
    expect(login.status).toBe(403);
  });
});
