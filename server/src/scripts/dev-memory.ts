/**
 * Zero-setup local run: starts an in-memory MongoDB replica set (transactions
 * supported), seeds demo data, and starts the API. Data persists in ./.mongo-data
 * between runs unless RESEED=true. Used by Playwright E2E as well.
 */
import path from 'path';
import fs from 'fs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  const persist = process.env.MEMORY_DB_PERSIST !== 'false';
  const dbPath = path.resolve(__dirname, '../../.mongo-data');
  const fresh = !persist || process.env.RESEED === 'true' || !fs.existsSync(dbPath);
  if (persist && fresh && fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true, force: true });
  if (persist) fs.mkdirSync(dbPath, { recursive: true });

  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: persist ? [{ dbPath, port: Number(process.env.MEMORY_DB_PORT ?? 27027) }] : [{}],
  });
  const uri = rs.getUri('coaching_fee');
  process.env.MONGODB_URI = uri;
  console.log(`In-memory MongoDB replica set: ${uri}`);

  const { connectDB } = await import('../config/db');
  const { start } = await import('../index');
  if (fresh) {
    await connectDB(uri);
    const { seedDatabase } = await import('../seed/seed');
    await seedDatabase();
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
  }
  const server = await start(uri);
  const shutdown = async () => {
    server.close();
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
    await rs.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
