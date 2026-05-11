import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { createDiaryEntry, getDiaryStats, listDiaryEntries } from "./diary.service";
import { subjects } from "./diary.types";

const evidenceReferenceSchema = z.object({
  evidenceId: z.string().min(1),
  objectKey: z.string().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
  includeInGuardianReport: z.boolean().default(true),
  includeImageInReports: z.boolean().default(false)
});

const curriculumTagSchema = z.object({
  standardId: z.string().optional(),
  keyStage: z.string().optional(),
  subject: z.string().min(1),
  topic: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

const createEntrySchema = z.object({
  studentId: z.string().min(1),
  occurredAt: z.string().datetime().default(() => new Date().toISOString()),
  durationMinutes: z.number().int().positive().max(1440),
  subject: z.enum(subjects),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  location: z.string().max(240).optional(),
  tutorAccountId: z.string().optional(),
  evidence: z.array(evidenceReferenceSchema).default([]),
  curriculumTags: z.array(curriculumTagSchema).default([]),
  shareWithTutorIds: z.array(z.string()).default([])
});

const studentParamsSchema = z.object({
  studentId: z.string().min(1)
});

const listEntriesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50)
});

export const diaryRoutes: FastifyPluginAsync = async (app) => {
  app.post("/entries", async (request, reply) => {
    const body = createEntrySchema.parse(request.body);
    const entry = await createDiaryEntry({
      ...body,
      createdByAccountId: request.account.accountId,
      createdByRole: request.account.role
    });

    reply.code(201).send({ data: entry });
  });

  app.get("/students/:studentId/entries", async (request) => {
    const params = studentParamsSchema.parse(request.params);
    const query = listEntriesQuerySchema.parse(request.query);
    const entries = await listDiaryEntries({
      studentId: params.studentId,
      ...query
    });

    return { data: entries };
  });

  app.get("/students/:studentId/stats", async (request) => {
    const params = studentParamsSchema.parse(request.params);
    const query = listEntriesQuerySchema.parse(request.query);
    const stats = await getDiaryStats({
      studentId: params.studentId,
      ...query
    });

    return { data: stats };
  });
};
