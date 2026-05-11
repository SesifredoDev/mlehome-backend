import { FastifyPluginAsync } from "fastify";

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/developer/manifest", async () => ({
    data: {
      name: "MLE Home Public API",
      version: "0.1.0",
      accountContext: {
        developmentHeaders: ["x-account-id", "x-account-role"],
        productionAuth: "Bearer JWT from API gateway"
      },
      scopes: [
        "stats:read",
        "entries:create",
        "evidence:create",
        "reports:tutor"
      ],
      endpoints: {
        createDiaryEntry: "POST /v1/diary/entries",
        createEvidenceUpload: "POST /v1/evidence/uploads",
        tutorStats: "GET /v1/reports/students/:studentId/stats",
        curriculumStandards: "GET /v1/curriculum/standards"
      }
    }
  }));
};
