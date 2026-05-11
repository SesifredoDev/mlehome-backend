import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { requireAccount } from "../../plugins/requestContext";
import {
  confirmEvidenceUpload,
  createEvidenceUpload,
  listEvidenceForStudent
} from "./evidence.service";

const createUploadSchema = z.object({
  studentId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  description: z.string().max(1000).optional()
});

const evidenceParamsSchema = z.object({
  evidenceId: z.string().min(1)
});

const confirmUploadSchema = z.object({
  sizeBytes: z.number().int().positive().optional()
});

const studentParamsSchema = z.object({
  studentId: z.string().min(1)
});

export const evidenceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/uploads", async (request, reply) => {
    const account = requireAccount(request);
    const body = createUploadSchema.parse(request.body);
    const result = await createEvidenceUpload({
      ...body,
      createdByAccountId: account.accountId
    });

    reply.code(201).send({ data: result });
  });

  app.post("/:evidenceId/confirm", async (request) => {
    requireAccount(request);
    const params = evidenceParamsSchema.parse(request.params);
    const body = confirmUploadSchema.parse(request.body ?? {});
    const asset = await confirmEvidenceUpload(params.evidenceId, body.sizeBytes);

    return { data: asset };
  });

  app.get("/students/:studentId", async (request) => {
    requireAccount(request);
    const params = studentParamsSchema.parse(request.params);
    const assets = await listEvidenceForStudent(params.studentId);

    return { data: assets };
  });
};
