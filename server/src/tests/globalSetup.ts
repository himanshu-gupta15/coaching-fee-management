import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalSetup() {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  (globalThis as unknown as { __MONGO_RS__: MongoMemoryReplSet }).__MONGO_RS__ = rs;
  process.env.TEST_MONGO_URI = rs.getUri();
}
