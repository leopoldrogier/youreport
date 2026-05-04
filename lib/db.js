import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "autoreport";

if (!uri) throw new Error('Missing env var "MONGODB_URI"');

let globalCache = global.__mongoCache;
if (!globalCache) {
  globalCache = global.__mongoCache = { client: null, promise: null };
}

async function getClient() {
  if (globalCache.client) return globalCache.client;
  if (!globalCache.promise) {
    const client = new MongoClient(uri, { maxPoolSize: 10 });
    globalCache.promise = client.connect().then((c) => {
      globalCache.client = c;
      return c;
    });
  }
  return globalCache.promise;
}

export async function getDb() {
  const client = await getClient();
  return client.db(dbName);
}