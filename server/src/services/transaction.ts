import mongoose, { type ClientSession } from 'mongoose';
import { supportsTransactions } from '../config/db';

/**
 * Runs fn inside a MongoDB transaction when the deployment supports it (Atlas /
 * replica sets). On a standalone dev server it runs without a session; the payment
 * service additionally uses a conditional atomic update so balances stay correct.
 */
export async function withTransaction<T>(fn: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  if (!(await supportsTransactions())) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
