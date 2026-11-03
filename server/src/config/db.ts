import mongoose from 'mongoose';

let transactionsSupported: boolean | null = null;

export async function connectDB(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  transactionsSupported = null;
}

/** Transactions require a replica set / sharded cluster (Atlas always is). */
export async function supportsTransactions(): Promise<boolean> {
  if (transactionsSupported !== null) return transactionsSupported;
  try {
    const admin = mongoose.connection.db!.admin();
    const hello = await admin.command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
