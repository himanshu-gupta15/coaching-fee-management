/**
 * Serverless entry point (Vercel). Each instance reuses one MongoDB connection
 * across requests. The long-running entry point for other hosts is index.ts;
 * its reminder timer does not run here, so reminders are sent from the dashboard.
 */
import type { Request, Response } from 'express';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

const app = createApp();
let connecting: Promise<void> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    connecting ??= connectDB(env.MONGODB_URI);
    await connecting;
  } catch (err) {
    connecting = null; // Let the next request retry.
    console.error('[db] connection failed', err instanceof Error ? err.name : 'unknown');
    res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'The database is unavailable. Please try again shortly.' } });
    return;
  }
  app(req, res);
}
