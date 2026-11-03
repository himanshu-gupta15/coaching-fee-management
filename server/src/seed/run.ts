import { env, isProd } from '../config/env';
import { connectDB, disconnectDB } from '../config/db';
import { seedDatabase, DEMO_CREDENTIALS } from './seed';

async function main() {
  if (isProd && process.env.SEED_CONFIRM !== 'yes') {
    console.error('Refusing to wipe a production database. Set SEED_CONFIRM=yes to proceed.');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);
  await seedDatabase();
  console.log('Demo credentials:', JSON.stringify(DEMO_CREDENTIALS, null, 2));
  await disconnectDB();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
