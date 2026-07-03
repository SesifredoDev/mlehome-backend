import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Readable } from "node:stream";

import { requireAccount } from "../../plugins/requestContext";
import {
  confirmEvidenceUpload,
  createEvidenceUpload,
  downloadEvidenceContent,
  listEvidenceForStudent,
  uploadEvidenceContent
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

const uploadContentParamsSchema = z.object({
  evidenceId: z.string().min(1)
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

  app.put("/:evidenceId/content", async (request, reply) => {
    requireAccount(request);
    const params = uploadContentParamsSchema.parse(request.params);

    const mimeType = typeof request.headers["content-type"] === "string" ? request.headers["content-type"] : "application/octet-stream";
    const query = request.query as { fileName?: string };
    const fileName = typeof query.fileName === "string" && query.fileName.trim() ? query.fileName : `${params.evidenceId}.bin`;
    const sizeHeader = Number(request.headers["content-length"]);
    const body = request.body as Buffer | undefined;

    if (!body) {
      throw new Error("Upload body was not received.");
    }

    const updatedAsset = await uploadEvidenceContent(params.evidenceId, {
      stream: Readable.from(body),
      fileName,
      mimeType,
      sizeBytes: Number.isFinite(sizeHeader) ? sizeHeader : undefined
    });

    return { data: updatedAsset };
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

  app.get("/:evidenceId/content", async (request, reply) => {
    requireAccount(request);
    const params = uploadContentParamsSchema.parse(request.params);
    const file = await downloadEvidenceContent(params.evidenceId);

    reply.header("Content-Type", file.mimeType);
    if (typeof file.sizeBytes === "number") {
      reply.header("Content-Length", String(file.sizeBytes));
    }
    reply.header("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, '\\"')}"`);

    return reply.send(file.stream);
  });
};
