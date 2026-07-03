import { GridFSBucket } from "mongodb";

import { getDb } from "../db/mongo";

export async function createEvidenceBucketAsync(): Promise<GridFSBucket> {
  const db = await getDb();
  return new GridFSBucket(db, {
    bucketName: "evidence_files"
  });
}

export function buildEvidenceObjectKey(input: {
  studentId: string;
  evidenceId: string;
  fileName: string;
}): string {
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `students/${input.studentId}/evidence/${input.evidenceId}/${safeFileName}`;
}

export function buildEvidenceContentRoute(evidenceId: string): string {
  return `/v1/evidence/${evidenceId}/content`;
}
