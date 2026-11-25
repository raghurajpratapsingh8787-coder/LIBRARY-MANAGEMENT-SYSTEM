import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { env } from './env';

let replSet: MongoMemoryReplSet | null = null;
let supportsTransactions = false;
let connectPromise: Promise<void> | null = null;

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    let uri = env.mongodbUri;

    if (!uri) {
      replSet = await MongoMemoryReplSet.create({
        replSet: {
          count: 1,
          storageEngine: 'wiredTiger',
        },
      });
      uri = replSet.getUri();
      supportsTransactions = true;
      console.log('Connected to embedded MongoDB Replica Set (development/preview mode)');
    } else {
      console.log('Connecting to configured external MongoDB instance...');
    }

    await mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10000,
    });

    if (env.mongodbUri) {
      try {
        const admin = mongoose.connection.db?.admin();
        const status = await admin?.command({ hello: 1 });
        supportsTransactions = Boolean(status?.setName || status?.msg === 'isdbgrid');
      } catch {
        supportsTransactions = false;
      }
    }
  })();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function canUseTransactions(): boolean {
  return supportsTransactions;
}

export async function runInTransaction<T>(
  work: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
  if (!supportsTransactions) {
    return work(null);
  }
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors during shutdown
  }
  if (replSet) {
    const target = replSet;
    replSet = null;
    try {
      await target.stop();
    } catch {
      // mongod may already be stopped by process-group SIGTERM
    }
  }
}
