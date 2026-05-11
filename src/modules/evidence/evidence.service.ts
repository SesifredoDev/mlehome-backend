import { getCollection } from "../../db/mongo";
import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import { notFound } from "../../shared/apiError";
import { buildEvidenceObjectKey, createPresignedPutUrl } from "../../storage/s3";
import { EvidenceAsset } from "./evidence.types";

interface CreateEvidenceUploadInput {
  studentId: string;
  createdByAccountId: string;
  fileName: string;
  mimeType: string;
  description?: string;
}

export async function createEvidenceUpload(input: CreateEvidenceUploadInput): Promise<{
  asset: EvidenceAsset;
  uploadUrl: string;
  expiresInSeconds: number;
}> {
  const evidenceId = createId("evd");
  const objectKey = buildEvidenceObjectKey({
    studentId: input.studentId,
    evidenceId,
    fileName: input.fileName
  });
  const presigned = await createPresignedPutUrl({ objectKey, mimeType: input.mimeType });
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
    asset,
    ...presigned
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

  const updates = {
    status: "uploaded" as const,
    sizeBytes,
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
