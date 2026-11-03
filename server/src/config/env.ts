import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5001),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/coaching_fee'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  INSTITUTE_NAME: z.string().default('BrightPath Academy'),
  INSTITUTE_TZ_OFFSET_MINUTES: z.coerce.number().default(330),
  REMINDER_DAYS_BEFORE_DUE: z.coerce.number().default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
/** Comma-separated list of allowed origins. */
export const allowedOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
