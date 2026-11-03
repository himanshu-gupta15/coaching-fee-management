import { User } from '../models';
import { api, auth, loginAdmin, setupDb, teardownDb } from './helpers';

beforeAll(() => setupDb('auth'));
afterAll(teardownDb);

describe('Authentication', () => {
  it('logs in with valid credentials and returns a token + user without password hash', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'admin@brightpath.edu', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects wrong password and unknown email with the same generic message', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'admin@brightpath.edu', password: 'nope1234' });
    const b = await api().post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope1234' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe('Invalid email or password');
    expect(b.body.error.message).toBe(a.body.error.message);
  });

  it('stores only bcrypt hashes, never plaintext', async () => {
    const u = await User.findOne({ email: 'admin@brightpath.edu' }).select('+passwordHash');
    expect(u!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(u!.passwordHash).not.toContain('Admin@123');
  });

  it('validates login input', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects requests with missing, malformed or forged tokens', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const jwt = await import('jsonwebtoken');
    const forged = jwt.sign({ sub: '64b000000000000000000000' }, 'wrong-secret-wrong-secret-wrong-secret');
    expect((await api().get('/api/auth/me').set(auth(forged))).status).toBe(401);
  });

  it('blocks disabled accounts', async () => {
    await User.updateOne({ email: 'imran.khan@example.com' }, { isActive: false });
    const res = await api().post('/api/auth/login').send({ email: 'imran.khan@example.com', password: 'Parent@123' });
    expect(res.status).toBe(403);
    await User.updateOne({ email: 'imran.khan@example.com' }, { isActive: true });
  });

  it('completes the password reset flow with a single-use token and invalidates old sessions', async () => {
    const admin = await loginAdmin();
    const parentToken = (await api().post('/api/auth/login').send({ email: 'sunita.verma@example.com', password: 'Parent@123' })).body.data.token;
    const sunita = await User.findOne({ email: 'sunita.verma@example.com' });
    const forgot = await api().post('/api/auth/forgot-password').send({ email: 'sunita.verma@example.com' });
    expect(forgot.status).toBe(200);
    const unknown = await api().post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.body.data.message).toBe(forgot.body.data.message); // no enumeration

    const link = await api().post(`/api/users/${sunita!._id}/reset-link`).set(auth(admin));
    const token = new URL(link.body.data.resetUrl).searchParams.get('token')!;
    await new Promise((r) => setTimeout(r, 1100));
    const reset = await api().post('/api/auth/reset-password').send({ token, password: 'NewPass123' });
    expect(reset.status).toBe(200);
    const reuse = await api().post('/api/auth/reset-password').send({ token, password: 'Another123' });
    expect(reuse.status).toBe(400);

    expect((await api().get('/api/auth/me').set(auth(parentToken))).status).toBe(401);
    const relogin = await api().post('/api/auth/login').send({ email: 'sunita.verma@example.com', password: 'NewPass123' });
    expect(relogin.status).toBe(200);
  });
});
