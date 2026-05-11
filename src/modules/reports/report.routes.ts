import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  generateEducationDiaryReport,
  generateTutorStatsReport
} from "./report.service";

const booleanFromQuery = z.preprocess((value) => {
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  return value;
}, z.boolean());

const studentParamsSchema = z.object({
  studentId: z.string().min(1)
});

const reportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeImages: booleanFromQuery.optional(),
  limit: z.coerce.number().int().positive().max(500).default(200)
});

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/students/:studentId/stats", async (request) => {
    const params = studentParamsSchema.parse(request.params);
    const query = reportQuerySchema.parse(request.query);
    const report = await generateTutorStatsReport(params.studentId, query);

    return { data: report };
  });

  app.get("/students/:studentId/education-diary", async (request) => {
    const params = studentParamsSchema.parse(request.params);
    const query = reportQuerySchema.parse(request.query);
    const report = await generateEducationDiaryReport(params.studentId, query);

    return { data: report };
  });
};
