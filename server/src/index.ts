import { env } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';
import { runFeeReminders } from './services/notification.service';

const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function start(uri = env.MONGODB_URI) {
  await connectDB(uri);
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  // In-process reminder job (idempotent). See docs/TDD.md for limitations on free hosting.
  const tick = () => runFeeReminders().catch((e) => console.error('[reminders]', e));
  setTimeout(tick, 10_000);
  const timer = setInterval(tick, REMINDER_INTERVAL_MS);
  server.on('close', () => clearInterval(timer));
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    if (err?.name === 'MongooseServerSelectionError') {
      const target = env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@');
      // eslint-disable-next-line no-console
      console.error(
        `\nCould not connect to MongoDB at ${target}\n\n` +
          '  • No MongoDB installed? Run `npm run dev:memory` instead (in-memory DB, auto-seeded).\n' +
          '  • Using Atlas? Set MONGODB_URI in server/.env and check Network Access allows your IP.\n',
      );
    } else {
      // eslint-disable-next-line no-console
      console.error('Failed to start server', err);
    }
    process.exit(1);
  });
}
