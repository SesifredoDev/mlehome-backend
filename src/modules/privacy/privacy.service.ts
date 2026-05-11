import { getCollection } from "../../db/mongo";
import { notFound } from "../../shared/apiError";
import { nowIso } from "../../shared/time";
import {
  BlurRegion,
  EvidenceAsset,
  EvidenceSharePolicy,
  PrivacyStatus
} from "../evidence/evidence.types";

export interface PrivacyReviewInput {
  imageContainsChildren?: boolean;
  containsThirdPartyChildren?: boolean;
  shareRequested?: boolean;
  guardianConfirmed?: boolean;
}

export interface PrivacyReviewResult {
  privacyStatus: PrivacyStatus;
  mustBlurBeforeReport: boolean;
  recommendedActions: string[];
}

export function reviewPrivacy(input: PrivacyReviewInput): PrivacyReviewResult {
  const recommendedActions: string[] = [];

  if (input.containsThirdPartyChildren) {
    recommendedActions.push("Blur third-party children before image inclusion.");
  }

  if (input.shareRequested && !input.guardianConfirmed) {
    recommendedActions.push("Require guardian confirmation before sharing beyond statistics.");
  }

  const mustBlurBeforeReport = Boolean(input.containsThirdPartyChildren);
  const privacyStatus: PrivacyStatus = mustBlurBeforeReport
    ? "needs_blur"
    : input.guardianConfirmed
      ? "approved"
      : "pending";

  return {
    privacyStatus,
    mustBlurBeforeReport,
    recommendedActions
  };
}

export async function savePrivacyDecision(
  evidenceId: string,
  input: {
    privacyStatus?: PrivacyStatus;
    blurRegions?: BlurRegion[];
    sharePolicy?: EvidenceSharePolicy;
    description?: string;
  }
): Promise<EvidenceAsset> {
  const assets = await getCollection<EvidenceAsset>("evidence_assets");
  const existing = await assets.findOne({ _id: evidenceId });

  if (!existing) {
    throw notFound("Evidence asset was not found.");
  }

  const updates = {
    ...(input.privacyStatus ? { privacyStatus: input.privacyStatus } : {}),
    ...(input.blurRegions ? { blurRegions: input.blurRegions } : {}),
    ...(input.sharePolicy ? { sharePolicy: input.sharePolicy } : {}),
    ...(input.description ? { description: input.description } : {}),
    updatedAt: nowIso()
  };

  await assets.updateOne({ _id: evidenceId }, { $set: updates });

  return {
    ...existing,
    ...updates
  };
}
