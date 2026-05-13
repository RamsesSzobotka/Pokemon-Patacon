import { MongoClient, Db } from 'mongodb';

let client: MongoClient;
let db: Db;

export async function connectMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-patacon';
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('✅ MongoDB connected');
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('MongoDB not connected');
  return db;
}

export function getClient(): MongoClient {
  return client;
}