import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { listStudentLinksForAccount } from "../auth/auth.service";
import { generateTutorStatsReport } from "../reports/report.service";

const studentParamsSchema = z.object({
  studentId: z.string().min(1)
});

export const tutorRoutes: FastifyPluginAsync = async (app) => {
  app.get("/students", async (request) => {
    const links = await listStudentLinksForAccount(request.account.accountId, "tutor");

    return {
      data: links
        .filter((link) => link.status === "active")
        .map((link) => ({
          studentId: link.studentId,
          scopes: link.scopes,
          activatedAt: link.activatedAt
        }))
    };
  });

  app.get("/students/:studentId/summary", async (request) => {
    const params = studentParamsSchema.parse(request.params);
    const report = await generateTutorStatsReport(params.studentId, {});

    return { data: report };
  });
};
