import { z } from 'zod';
import { Types } from 'mongoose';

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v), 'Invalid id');
export const idParams = z.object({ id: objectId });
export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const paise = z.number().int('Amount must be in whole paise').positive('Amount must be greater than zero').max(10_000_000_00, 'Amount too large');
export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
export const phone = z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number').optional().or(z.literal(''));
export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
export const name = z.string().trim().min(2, 'Name is too short').max(120);
export const booleanish = z.enum(['true', 'false']).transform((v) => v === 'true');
