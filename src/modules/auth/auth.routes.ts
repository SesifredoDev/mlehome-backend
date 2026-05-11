import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  activateStudentLink,
  createStudentLink,
  listStudentLinksForAccount
} from "./auth.service";
import { linkScopes } from "./auth.types";

const createStudentLinkSchema = z.object({
  studentId: z.string().min(1),
  scopes: z.array(z.enum(linkScopes)).default(["stats:read", "entries:create"]),
  expiresAt: z.string().datetime().optional()
});

const activateStudentLinkSchema = z.object({
  code: z.string().min(6).max(32)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/student-links", async (request, reply) => {
    const body = createStudentLinkSchema.parse(request.body);
    const link = await createStudentLink({
      ...body,
      guardianAccountId: request.account.accountId
    });

    reply.code(201).send({ data: link });
  });

  app.post("/student-links/activate", async (request, reply) => {
    const body = activateStudentLinkSchema.parse(request.body);
    const link = await activateStudentLink(body.code, request.account.accountId);

    reply.code(200).send({ data: link });
  });

  app.get("/student-links", async (request) => {
    const role = request.account.role === "tutor" ? "tutor" : "guardian";
    const links = await listStudentLinksForAccount(request.account.accountId, role);

    return { data: links };
  });
};
