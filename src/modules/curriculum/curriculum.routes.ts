import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { listCurriculumStandards } from "./curriculum.service";

const standardsQuerySchema = z.object({
  subject: z.string().optional(),
  keyStage: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100)
});

export const curriculumRoutes: FastifyPluginAsync = async (app) => {
  app.get("/standards", async (request) => {
    const query = standardsQuerySchema.parse(request.query);
    const standards = await listCurriculumStandards(query);

    return { data: standards };
  });
};
