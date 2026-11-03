import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { env, isProd } from '../config/env';
import { signToken } from '../middleware/auth';
import { Student } from '../models/Student';
import { User, type UserDoc } from '../models/User';
import { audit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { hashToken } from '../utils/ids';
import { ok } from '../utils/response';

export const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 30 * 60 * 1000;
// Used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 10);

export async function publicUser(user: UserDoc) {
  const base = user.toJSON() as Record<string, unknown>;
  if (user.role === 'student') {
    const s = await Student.findOne({ user: user._id, deletedAt: null }).select('_id studentId fullName').lean();
    base.studentProfile = s ? { _id: s._id, studentId: s.studentId, fullName: s.fullName } : null;
  }
  return base;
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.valid!.body as { email: string; password: string };
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await audit(req, { action: 'auth.login_failed', entityType: 'User', summary: `Failed login for ${email}` });
    throw AppError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'Your account has been disabled. Please contact the institute.');
  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  await audit(req, { action: 'auth.login', entityType: 'User', entityId: String(user._id), summary: `${user.name} signed in` });
  return ok(res, { token: signToken(String(user._id)), user: await publicUser(user) });
}

export async function me(req: Request, res: Response) {
  return ok(res, { user: await publicUser(req.user!) });
}

export async function logout(req: Request, res: Response) {
  await audit(req, { action: 'auth.logout', entityType: 'User', entityId: String(req.user!._id), summary: `${req.user!.name} signed out` });
  return ok(res, { message: 'Signed out' });
}

/** Creates a single-use reset token; only its SHA-256 hash is stored. */
export async function createResetToken(user: UserDoc): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await User.updateOne(
    { _id: user._id },
    { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + RESET_TTL_MS) },
  );
  return token;
}

export function resetUrl(token: string) {
  const base = env.CLIENT_URL.split(',')[0].trim().replace(/\/$/, '');
  return `${base}/reset-password?token=${token}`;
}

/**
 * Always responds identically whether or not the account exists (no user enumeration).
 * No email provider is integrated in this MVP: the link is written to the server log
 * in non-production, and admins can generate a reset link from the Users screen.
 */
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.valid!.body as { email: string };
  const user = await User.findOne({ email, isActive: true });
  if (user) {
    const token = await createResetToken(user);
    req.user = user;
    await audit(req, { action: 'auth.reset_requested', entityType: 'User', entityId: String(user._id), summary: `Password reset requested for ${email}` });
    // eslint-disable-next-line no-console
    if (!isProd && env.NODE_ENV !== 'test') console.info(`[password-reset] ${email}: ${resetUrl(token)}`);
  }
  return ok(res, {
    message: 'If an account exists for that email, password reset instructions have been issued. Please contact the institute office if you do not receive them.',
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.valid!.body as { token: string; password: string };
  const user = await User.findOne({ resetTokenHash: hashToken(token), resetTokenExpiresAt: { $gt: new Date() }, isActive: true });
  if (!user) throw AppError.badRequest('This reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.passwordChangedAt = new Date();
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
  req.user = user;
  await audit(req, { action: 'auth.password_reset', entityType: 'User', entityId: String(user._id), summary: `${user.name} reset their password` });
  return ok(res, { message: 'Password updated. You can now sign in.' });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.valid!.body as { currentPassword: string; newPassword: string };
  const user = await User.findById(req.user!._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.badRequest('Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.passwordChangedAt = new Date();
  await user.save();
  await audit(req, { action: 'auth.password_changed', entityType: 'User', entityId: String(user._id), summary: `${user.name} changed their password` });
  return ok(res, { message: 'Password changed', token: signToken(String(user._id)) });
}
