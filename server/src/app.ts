import './types/express';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { allowedOrigins, env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import { sanitizeBody } from './middleware/sanitize';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render / Vercel sit behind a proxy
  app.set('query parser', 'simple');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin) and configured client origins.
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitizeBody);
  if (env.NODE_ENV === 'development') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
  });
  app.use('/api', apiLimiter, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
