import { FastifyInstance, FastifyRequest } from "fastify";

import { env } from "../config/env";
import { verifyAccessToken } from "../modules/auth/jwt.service";
import { unauthorized } from "../shared/apiError";
import { AccountRole, parseAccountRole } from "../shared/roles";

export interface RequestAccount {
  accountId: string;
  role: AccountRole;
  email?: string;
  tokenId?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    account?: RequestAccount;
  }
}

export function installRequestContext(app: FastifyInstance): void {
  app.addHook("preHandler", async (request) => {
    const bearerToken = readBearerToken(request.headers.authorization);

    if (bearerToken) {
      const claims = verifyAccessToken(bearerToken);
      request.account = {
        accountId: claims.sub,
        role: claims.role,
        email: claims.email,
        tokenId: claims.jti
      };
      return;
    }

    if (env.NODE_ENV !== "production") {
      const accountId = readHeader(request.headers["x-account-id"]);
      const role = parseAccountRole(readHeader(request.headers["x-account-role"]));

      if (accountId && role) {
        request.account = { accountId, role };
      }
    }
  });
}

export function requireAccount(request: FastifyRequest): RequestAccount {
  if (!request.account) {
    throw unauthorized("Authentication required.");
  }

  return request.account;
}

function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readBearerToken(value: string | string[] | undefined): string | undefined {
  const header = readHeader(value);

  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}
