import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const disabled = env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => disabled,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a few minutes.' } },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => disabled,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});
