import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { reviewPrivacy, savePrivacyDecision } from "./privacy.service";

const privacyStatusSchema = z.enum(["pending", "approved", "needs_blur", "restricted"]);

const blurRegionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  reason: z.string().optional()
});

const sharePolicySchema = z.object({
  includeInGuardianReport: z.boolean(),
  includeImageInReports: z.boolean(),
  shareWithTutorIds: z.array(z.string())
});

const privacyReviewSchema = z.object({
  imageContainsChildren: z.boolean().optional(),
  containsThirdPartyChildren: z.boolean().optional(),
  shareRequested: z.boolean().optional(),
  guardianConfirmed: z.boolean().optional()
});

const privacyDecisionSchema = z.object({
  privacyStatus: privacyStatusSchema.optional(),
  blurRegions: z.array(blurRegionSchema).optional(),
  sharePolicy: sharePolicySchema.optional(),
  description: z.string().max(1000).optional()
});

const evidenceParamsSchema = z.object({
  evidenceId: z.string().min(1)
});

export const privacyRoutes: FastifyPluginAsync = async (app) => {
  app.post("/reviews", async (request) => {
    const body = privacyReviewSchema.parse(request.body);

    return { data: reviewPrivacy(body) };
  });

  app.patch("/evidence/:evidenceId/decision", async (request) => {
    const params = evidenceParamsSchema.parse(request.params);
    const body = privacyDecisionSchema.parse(request.body);
    const asset = await savePrivacyDecision(params.evidenceId, body);

    return { data: asset };
  });
};
