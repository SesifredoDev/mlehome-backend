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
  const childLinks = db.collection("child_links");

  await dropIndexIfExists(childLinks, "code_1");

  await Promise.all([
    db.collection("accounts").createIndex({ emailNormalized: 1 }, { unique: true }),
    db.collection("accounts").createIndex({ createdAt: -1 }),
    db.collection("refresh_tokens").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("refresh_tokens").createIndex({ accountId: 1, revokedAt: 1 }),
    db.collection("refresh_tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("student_links").createIndex({ code: 1 }, { unique: true }),
    db.collection("student_links").createIndex({ guardianAccountId: 1, studentId: 1 }),
    db.collection("student_links").createIndex({ tutorAccountId: 1, studentId: 1 }),
    db.collection("guardian_links").createIndex({ code: 1 }, { unique: true }),
    db.collection("guardian_links").createIndex({ headGuardianAccountId: 1, childLinkId: 1 }),
    childLinks.createIndex({ guardianAccountId: 1, studentId: 1 }),
    childLinks.createIndex({ guardianAccountIds: 1, studentId: 1 }),
    childLinks.createIndex({ childAccountId: 1, studentId: 1 }),
    db.collection("diary_entries").createIndex({ studentId: 1, occurredAt: -1 }),
    db.collection("diary_entries").createIndex({ tutorAccountId: 1, occurredAt: -1 }),
    db.collection("evidence_assets").createIndex({ studentId: 1, createdAt: -1 }),
    db.collection("curriculum_standards").createIndex({ subject: 1, keyStage: 1 })
  ]);
}

async function dropIndexIfExists(
  collection: Collection<Document>,
  indexName: string
): Promise<void> {
  try {
    await collection.dropIndex(indexName);
  } catch (error) {
    const mongoError = error as { code?: number; codeName?: string };

    if (
      mongoError.code === 26 ||
      mongoError.code === 27 ||
      mongoError.codeName === "NamespaceNotFound" ||
      mongoError.codeName === "IndexNotFound"
    ) {
      return;
    }

    throw error;
  }
}
