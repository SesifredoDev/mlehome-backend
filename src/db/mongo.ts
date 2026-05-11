import { Collection, Db, Document, MongoClient } from "mongodb";

import { env } from "../config/env";

let client: MongoClient | undefined;
let database: Db | undefined;
let indexesReady = false;

export async function getDb(): Promise<Db> {
  if (!client || !database) {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    database = client.db(env.MONGODB_DB);
  }

  if (!indexesReady) {
    await ensureIndexes(database);
    indexesReady = true;
  }

  return database;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export async function pingMongo(): Promise<void> {
  const db = await getDb();
  await db.command({ ping: 1 });
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
  }

  client = undefined;
  database = undefined;
  indexesReady = false;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("student_links").createIndex({ code: 1 }, { unique: true }),
    db.collection("student_links").createIndex({ guardianAccountId: 1, studentId: 1 }),
    db.collection("student_links").createIndex({ tutorAccountId: 1, studentId: 1 }),
    db.collection("diary_entries").createIndex({ studentId: 1, occurredAt: -1 }),
    db.collection("diary_entries").createIndex({ tutorAccountId: 1, occurredAt: -1 }),
    db.collection("evidence_assets").createIndex({ studentId: 1, createdAt: -1 }),
    db.collection("curriculum_standards").createIndex({ subject: 1, keyStage: 1 })
  ]);
}
