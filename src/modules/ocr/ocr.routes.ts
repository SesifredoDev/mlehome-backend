import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { inferActivity } from "./ocr.service";

const inferActivitySchema = z
  .object({
    text: z.string().optional(),
    imageObjectKey: z.string().optional()
  })
  .refine((value) => value.text || value.imageObjectKey, {
    message: "Either text or imageObjectKey is required."
  });

export const ocrRoutes: FastifyPluginAsync = async (app) => {
  app.post("/infer", async (request) => {
    const body = inferActivitySchema.parse(request.body);
    const inference = await inferActivity(body);

    return { data: inference };
  });
};
