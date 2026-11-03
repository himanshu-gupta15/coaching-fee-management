import '../types/express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, type Role } from '../models/User';
import { AppError } from '../utils/AppError';

interface TokenPayload {
  sub: string;
  iat: number;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/**
 * Verifies the bearer token and loads the user from the database on every request.
 * The role is always read from the database — never from the token or the client.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(AppError.unauthorized());
  const token = header.slice(7);
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return next(AppError.unauthorized('Your session has expired. Please sign in again.'));
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) return next(AppError.unauthorized('Account not found or disabled'));
  // Invalidate tokens issued before the last password change (1s tolerance for iat granularity).
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    return next(AppError.unauthorized('Your password was changed. Please sign in again.'));
  }
  req.user = user;
  next();
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}
