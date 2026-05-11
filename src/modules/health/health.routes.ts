import { FastifyPluginAsync } from "fastify";

import { pingMongo } from "../../db/mongo";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    status: "ok",
    service: "mlehome-backend"
  }));

  app.get("/ready", async () => {
    await pingMongo();

    return {
      status: "ready",
      checks: {
        mongo: "ok"
      }
    };
  });
};
