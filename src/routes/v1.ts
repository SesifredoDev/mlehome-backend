import { FastifyPluginAsync } from "fastify";

import { accountRoutes } from "../modules/accounts/accounts.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { curriculumRoutes } from "../modules/curriculum/curriculum.routes";
import { diaryRoutes } from "../modules/diary/diary.routes";
import { evidenceRoutes } from "../modules/evidence/evidence.routes";
import { integrationRoutes } from "../modules/integrations/integration.routes";
import { ocrRoutes } from "../modules/ocr/ocr.routes";
import { privacyRoutes } from "../modules/privacy/privacy.routes";
import { reportRoutes } from "../modules/reports/report.routes";
import { tutorRoutes } from "../modules/tutors/tutor.routes";

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(accountRoutes, { prefix: "/accounts" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(diaryRoutes, { prefix: "/diary" });
  await app.register(evidenceRoutes, { prefix: "/evidence" });
  await app.register(ocrRoutes, { prefix: "/ocr" });
  await app.register(privacyRoutes, { prefix: "/privacy" });
  await app.register(reportRoutes, { prefix: "/reports" });
  await app.register(tutorRoutes, { prefix: "/tutors" });
  await app.register(curriculumRoutes, { prefix: "/curriculum" });
  await app.register(integrationRoutes, { prefix: "/integrations" });
};
