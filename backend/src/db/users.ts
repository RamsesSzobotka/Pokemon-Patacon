import { Collection, ObjectId } from 'mongodb';
import { getDB } from './mongodb';

export interface UserDocument {
  _id?: ObjectId;
  clerk_user_id: string;
  email: string;
  player_name: string;
  session_id: string | null;
  created_at: Date;
  last_login_at: Date;
  games_played: number;
  wins: number;
}

let usersCollection: Collection<UserDocument> | null = null;

export function getUsersCollection(): Collection<UserDocument> {
  if (!usersCollection) {
    const db = getDB();
    usersCollection = db.collection<UserDocument>('users');
  }
  return usersCollection;
}

export async function initializeUsersIndexes(): Promise<void> {
  const collection = getUsersCollection();

  try {
    await collection.createIndex({ clerk_user_id: 1 }, { unique: true });
    await collection.createIndex({ session_id: 1 });

    console.log('✅ Índices de users creados');
  } catch (error) {
    console.log('⚠️ Índices de users ya existen o error menor:', (error as Error).message);
  }
}

export async function getUserByClerkId(clerkUserId: string): Promise<UserDocument | null> {
  const collection = getUsersCollection();
  return await collection.findOne({ clerk_user_id: clerkUserId });
}

export async function createUser(clerkUserId: string, email: string, playerName: string): Promise<UserDocument> {
  const collection = getUsersCollection();

  const now = new Date();

  const user: UserDocument = {
    clerk_user_id: clerkUserId,
    email,
    player_name: playerName,
    session_id: null,
    created_at: now,
    last_login_at: now,
    games_played: 0,
    wins: 0,
  };

  const result = await collection.insertOne(user);

  return {
    _id: result.insertedId,
    ...user,
  };
}

export async function getSessionIdByClerkId(clerkUserId: string): Promise<string | null> {
  const collection = getUsersCollection();
  const user = await collection.findOne(
    { clerk_user_id: clerkUserId },
    { projection: { session_id: 1, _id: 0 } }
  );
  return user?.session_id ?? null;
}

export async function getClerkIdBySessionId(sessionId: string): Promise<string | null> {
  const collection = getUsersCollection();
  const user = await collection.findOne(
    { session_id: sessionId },
    { projection: { clerk_user_id: 1, _id: 0 } }
  );
  return user?.clerk_user_id ?? null;
}

export async function updateUser(clerkUserId: string, fields: Record<string, any>): Promise<void> {
  const collection = getUsersCollection();

  await collection.updateOne(
    { clerk_user_id: clerkUserId },
    { $set: { ...fields, last_login_at: new Date() } }
  );
}

export async function deleteUser(clerkUserId: string): Promise<boolean> {
  const collection = getUsersCollection();

  const result = await collection.deleteOne({ clerk_user_id: clerkUserId });
  return result.deletedCount > 0;
}
