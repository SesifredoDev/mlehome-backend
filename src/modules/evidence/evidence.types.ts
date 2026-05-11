export type EvidenceStatus = "pending_upload" | "uploaded" | "rejected";

export type PrivacyStatus = "pending" | "approved" | "needs_blur" | "restricted";

export interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
}

export interface EvidenceSharePolicy {
  includeInGuardianReport: boolean;
  includeImageInReports: boolean;
  shareWithTutorIds: string[];
}

export interface EvidenceAsset {
  _id: string;
  studentId: string;
  createdByAccountId: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  status: EvidenceStatus;
  privacyStatus: PrivacyStatus;
  blurRegions: BlurRegion[];
  sharePolicy: EvidenceSharePolicy;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
