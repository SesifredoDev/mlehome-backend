import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  activateStudentLink,
  createStudentLink,
  listStudentLinksForAccount
} from "./auth.service";
import { linkScopes } from "./auth.types";
import { requireAccount } from "../../plugins/requestContext";
import {
  loginWithPassword,
  refreshAuthTokens,
  revokeAllRefreshTokens,
  revokeRefreshToken
} from "./session.service";

const createStudentLinkSchema = z.object({
  studentId: z.string().min(1),
  scopes: z.array(z.enum(linkScopes)).default(["stats:read", "entries:create"]),
  expiresAt: z.string().datetime().optional()
});

const activateStudentLinkSchema = z.object({
  code: z.string().min(6).max(32)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32)
});

const logoutSchema = z.object({
  refreshToken: z.string().min(32)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request) => {
    const body = loginSchema.parse(request.body);
    const tokenSet = await loginWithPassword({
      ...body,
      context: getClientContext(request)
    });

    return { data: tokenSet };
  });

  app.post("/refresh", async (request) => {
    const body = refreshSchema.parse(request.body);
    const tokenSet = await refreshAuthTokens({
      refreshToken: body.refreshToken,
      context: getClientContext(request)
    });

    return { data: tokenSet };
  });

  app.post("/logout", async (request) => {
    const body = logoutSchema.parse(request.body);
    await revokeRefreshToken(body.refreshToken);

    return { data: { revoked: true } };
  });

  app.post("/logout-all", async (request) => {
    const account = requireAccount(request);
    const revokedCount = await revokeAllRefreshTokens(account.accountId);

    return { data: { revokedCount } };
  });

  app.post("/student-links", async (request, reply) => {
    const account = requireAccount(request);
    const body = createStudentLinkSchema.parse(request.body);
    const link = await createStudentLink({
      ...body,
      guardianAccountId: account.accountId
    });

    reply.code(201).send({ data: link });
  });

  app.post("/student-links/activate", async (request, reply) => {
    const account = requireAccount(request);
    const body = activateStudentLinkSchema.parse(request.body);
    const link = await activateStudentLink(body.code, account.accountId);

    reply.code(200).send({ data: link });
  });

  app.get("/student-links", async (request) => {
    const account = requireAccount(request);
    const role = account.role === "tutor" ? "tutor" : "guardian";
    const links = await listStudentLinksForAccount(account.accountId, role);

    return { data: links };
  });
};

function getClientContext(request: FastifyRequest) {
  return {
    userAgent: readHeader(request.headers["user-agent"]),
    ipAddress: request.ip
  };
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
