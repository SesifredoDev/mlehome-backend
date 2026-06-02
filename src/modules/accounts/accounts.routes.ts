import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAccountById, registerAccount, toPublicAccount } from "./accounts.service";
import { requireAccount } from "../../plugins/requestContext";

const publicAccountRoles = ["parent", "tutor", "integration"] as const;

const registerAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  displayName: z.string().min(1).max(160).optional(),
  role: z.enum(publicAccountRoles).default("parent")
});

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const body = registerAccountSchema.parse(request.body);
    const account = await registerAccount(body);

    reply.code(201).send({ data: account });
  });

  app.get("/me", async (request) => {
    const requestAccount = requireAccount(request);
    const account = await getAccountById(requestAccount.accountId);

    return { data: toPublicAccount(account) };
  });
};
