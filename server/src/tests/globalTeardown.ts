import type { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalTeardown() {
  await (globalThis as unknown as { __MONGO_RS__?: MongoMemoryReplSet }).__MONGO_RS__?.stop();
}
