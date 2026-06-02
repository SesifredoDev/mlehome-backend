import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  activateGuardianLink,
  activateStudentLink,
  createChildLink,
  createGuardianLink,
  listChildGuardianAccess,
  createStudentLink,
  listGuardianTutorAccess,
  listChildLinksForAccount,
  listStudentLinksForAccount,
  revokeChildGuardianAccess,
  revokeChildLink,
  updateChildLinkProfile,
  updateGuardianTutorChildren
} from "./auth.service";
import { linkScopes } from "./auth.types";
import { requireAccount } from "../../plugins/requestContext";
import { forbidden } from "../../shared/apiError";
import {
  loginWithPassword,
  refreshAuthTokens,
  revokeAllRefreshTokens,
  revokeRefreshToken
} from "./session.service";

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must use YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date of birth must be a real date.")
  .refine((value) => new Date(`${value}T00:00:00.000Z`).getTime() <= Date.now(), {
    message: "Date of birth cannot be in the future."
  });

const createStudentLinkSchema = z.object({
  studentId: z.string().min(1).optional(),
  childLinkId: z.string().min(1).optional(),
  scopes: z.array(z.enum(linkScopes)).default(["stats:read", "entries:create"]),
  expiresAt: z.string().datetime().optional()
}).refine((value) => value.studentId || value.childLinkId, {
  message: "Select a child before creating a tutor link."
});

const createChildLinkSchema = z.object({
  studentName: z.string().min(1).max(160).optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  age: z.number().int().min(0).max(30).optional(),
  keyStage: z.string().min(1).max(80).optional(),
  year: z.string().min(1).max(80).optional(),
  canLogEntries: z.boolean().default(true)
});

const activateStudentLinkSchema = z.object({
  code: z.string().min(6).max(32)
});

const createGuardianLinkSchema = z.object({
  childLinkId: z.string().min(1),
  expiresAt: z.string().datetime().optional()
});

const activateGuardianLinkSchema = z.object({
  code: z.string().min(6).max(32)
});

const createChildLoginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  displayName: z.string().min(1).max(160).optional()
});

const updateChildLinkProfileSchema = z.object({
  studentName: z.string().min(1).max(160),
  dateOfBirth: dateOfBirthSchema.optional(),
  age: z.number().int().min(0).max(30).optional(),
  keyStage: z.string().min(1).max(80).optional(),
  year: z.string().min(1).max(80).optional(),
  canLogEntries: z.boolean().optional(),
  loginEnabled: z.boolean().optional(),
  loginCredentials: createChildLoginCredentialsSchema.optional()
});

const revokeChildLinkParamsSchema = z.object({
  linkId: z.string().min(1)
});

const guardianAccessParamsSchema = z.object({
  linkId: z.string().min(1),
  guardianAccountId: z.string().min(1)
});

const tutorParamsSchema = z.object({
  tutorAccountId: z.string().min(1)
});

const updateTutorChildrenSchema = z.object({
  childLinkIds: z.array(z.string().min(1)).default([]),
  scopes: z.array(z.enum(linkScopes)).optional()
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

const createChildRecordSchema = createChildLinkSchema.extend({
  studentName: z.string().min(1).max(160),
  loginCredentials: createChildLoginCredentialsSchema.optional()
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

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can generate tutor links.");
    }

    const body = createStudentLinkSchema.parse(request.body);
    const link = await createStudentLink({
      ...body,
      guardianAccountId: account.accountId
    });

    reply.code(201).send({ data: link });
  });

  app.post("/student-links/activate", async (request, reply) => {
    const account = requireAccount(request);

    if (account.role !== "tutor") {
      throw forbidden("Only tutor accounts can activate tutor links.");
    }

    const body = activateStudentLinkSchema.parse(request.body);
    const link = await activateStudentLink(body.code, account.accountId);

    reply.code(200).send({ data: link });
  });

  app.post("/guardian-links", async (request, reply) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can generate guardian links.");
    }

    const body = createGuardianLinkSchema.parse(request.body);
    const link = await createGuardianLink({
      ...body,
      headGuardianAccountId: account.accountId
    });

    reply.code(201).send({ data: link });
  });

  app.post("/guardian-links/activate", async (request, reply) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can activate guardian links.");
    }

    const body = activateGuardianLinkSchema.parse(request.body);
    const link = await activateGuardianLink(body.code, account.accountId);

    reply.code(200).send({ data: link });
  });

  app.get("/student-links", async (request) => {
    const account = requireAccount(request);
    const role = account.role === "tutor" ? "tutor" : "guardian";
    const links = await listStudentLinksForAccount(account.accountId, role);

    return { data: links };
  });

  app.get("/guardian-tutors", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can manage tutor access.");
    }

    const tutors = await listGuardianTutorAccess(account.accountId);

    return { data: tutors };
  });

  app.put("/guardian-tutors/:tutorAccountId/children", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can manage tutor access.");
    }

    const params = tutorParamsSchema.parse(request.params);
    const body = updateTutorChildrenSchema.parse(request.body);
    const tutors = await updateGuardianTutorChildren({
      guardianAccountId: account.accountId,
      tutorAccountId: params.tutorAccountId,
      childLinkIds: body.childLinkIds,
      scopes: body.scopes
    });

    return { data: tutors };
  });

  app.post("/child-links", async (request, reply) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can create child records.");
    }

    const body = createChildRecordSchema.parse(request.body);
    const link = await createChildLink({
      ...body,
      guardianAccountId: account.accountId
    });

    reply.code(201).send({ data: link });
  });

  app.get("/child-links", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent" && account.role !== "child") {
      throw forbidden("Only parent and child accounts can list child records.");
    }

    const role = account.role === "child" ? "child" : "guardian";
    const links = await listChildLinksForAccount(account.accountId, role);

    return { data: links };
  });

  app.get("/child-links/:linkId/guardians", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can manage guardian access.");
    }

    const params = revokeChildLinkParamsSchema.parse(request.params);
    const guardians = await listChildGuardianAccess(params.linkId, account.accountId);

    return { data: guardians };
  });

  app.put("/child-links/:linkId", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can update child details.");
    }

    const params = revokeChildLinkParamsSchema.parse(request.params);
    const body = updateChildLinkProfileSchema.parse(request.body);
    const link = await updateChildLinkProfile({
      ...body,
      linkId: params.linkId,
      guardianAccountId: account.accountId
    });

    return { data: link };
  });

  app.delete("/child-links/:linkId/guardians/:guardianAccountId", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can manage guardian access.");
    }

    const params = guardianAccessParamsSchema.parse(request.params);
    const guardians = await revokeChildGuardianAccess({
      childLinkId: params.linkId,
      headGuardianAccountId: account.accountId,
      guardianAccountId: params.guardianAccountId
    });

    return { data: guardians };
  });

  app.post("/child-links/:linkId/revoke", async (request) => {
    const account = requireAccount(request);

    if (account.role !== "parent") {
      throw forbidden("Only parent accounts can revoke child records.");
    }

    const params = revokeChildLinkParamsSchema.parse(request.params);
    const link = await revokeChildLink(params.linkId, account.accountId);

    return { data: link };
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
