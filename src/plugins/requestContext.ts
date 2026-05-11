import { FastifyPluginAsync } from "fastify";

import { AccountRole, parseAccountRole } from "../shared/roles";

export interface RequestAccount {
  accountId: string;
  role: AccountRole;
}

declare module "fastify" {
  interface FastifyRequest {
    account: RequestAccount;
  }
}

export const requestContextPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    const accountId = readHeader(request.headers["x-account-id"]) ?? "local-dev-account";
    const role = parseAccountRole(readHeader(request.headers["x-account-role"])) ?? "parent";

    request.account = { accountId, role };
  });
};

function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
