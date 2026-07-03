import { getCollection } from "../../db/mongo";
import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import { notFound } from "../../shared/apiError";
import { createEvidenceBucketAsync, buildEvidenceObjectKey } from "../../storage/s3";
import { EvidenceAsset } from "./evidence.types";
import { pipeline } from "node:stream/promises";

interface CreateEvidenceUploadInput {
  studentId: string;
  createdByAccountId: string;
  fileName: string;
  mimeType: string;
  description?: string;
}

export async function createEvidenceUpload(input: CreateEvidenceUploadInput): Promise<{
  asset: EvidenceAsset;
}> {
  const evidenceId = createId("evd");
  const objectKey = buildEvidenceObjectKey({
    studentId: input.studentId,
    evidenceId,
    fileName: input.fileName
  });
  const timestamp = nowIso();
  const asset: EvidenceAsset = {
    _id: evidenceId,
    studentId: input.studentId,
    createdByAccountId: input.createdByAccountId,
    objectKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    status: "pending_upload",
    privacyStatus: "pending",
    blurRegions: [],
    sharePolicy: {
      includeInGuardianReport: true,
      includeImageInReports: false,
      shareWithTutorIds: []
    },
    description: input.description,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const assets = await getCollection<EvidenceAsset>("evidence_assets");
  await assets.insertOne(asset);

  return {
    asset
  };
}

export async function confirmEvidenceUpload(
  evidenceId: string,
  sizeBytes?: number
): Promise<EvidenceAsset> {
  const assets = await getCollection<EvidenceAsset>("evidence_assets");
  const existing = await assets.findOne({ _id: evidenceId });

  if (!existing) {
    throw notFound("Evidence asset was not found.");
  }

  const bucket = await createEvidenceBucketAsync();
  const file = await bucket.find({ filename: evidenceId }).next();

  if (!file) {
    throw notFound("Evidence file was not found.");
  }

  const updates = {
    status: "uploaded" as const,
    sizeBytes: sizeBytes ?? file.length,
    updatedAt: nowIso()
  };

  await assets.updateOne({ _id: evidenceId }, { $set: updates });

  return {
    ...existing,
    ...updates
  };
}

export async function listEvidenceForStudent(studentId: string): Promise<EvidenceAsset[]> {
  const assets = await getCollection<EvidenceAsset>("evidence_assets");

  return assets.find({ studentId }).sort({ createdAt: -1 }).limit(200).toArray();
}

export async function uploadEvidenceContent(
  evidenceId: string,
  input: {
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
    sizeBytes?: number;
  }
): Promise<EvidenceAsset> {
  const assets = await getCollection<EvidenceAsset>("evidence_assets");
  const existing = await assets.findOne({ _id: evidenceId });

  if (!existing) {
    throw notFound("Evidence asset was not found.");
  }

  const bucket = await createEvidenceBucketAsync();
  const existingFile = await bucket.find({ filename: evidenceId }).next();
  if (existingFile) {
    await bucket.delete(existingFile._id).catch(() => undefined);
  }

  const uploadStream = bucket.openUploadStream(evidenceId, {
    contentType: input.mimeType,
    metadata: {
      evidenceId,
      studentId: existing.studentId,
      createdByAccountId: existing.createdByAccountId,
      description: existing.description,
      originalFileName: input.fileName
    }
  });

  await pipeline(input.stream, uploadStream);

  const uploadedFile = await bucket.find({ filename: evidenceId }).next();

  const updated: Partial<EvidenceAsset> = {
    status: "uploaded",
    sizeBytes: input.sizeBytes ?? uploadedFile?.length,
    updatedAt: nowIso()
  };

  await assets.updateOne({ _id: evidenceId }, { $set: updated });

  return {
    ...existing,
    ...updated
  };
}

export async function downloadEvidenceContent(evidenceId: string): Promise<{
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}> {
  const assets = await getCollection<EvidenceAsset>("evidence_assets");
  const existing = await assets.findOne({ _id: evidenceId });

  if (!existing) {
    throw notFound("Evidence asset was not found.");
  }

  const bucket = await createEvidenceBucketAsync();
  const file = await bucket.find({ filename: evidenceId }).next();

  if (!file) {
    throw notFound("Evidence file was not found.");
  }

  return {
    stream: bucket.openDownloadStreamByName(evidenceId),
    fileName: file.metadata?.originalFileName || existing.fileName,
    mimeType: file.contentType || existing.mimeType,
    sizeBytes: file.length
  };
}
