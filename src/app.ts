import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { ZodError } from "zod";

import { env } from "./config/env";
import { healthRoutes } from "./modules/health/health.routes";
import { installRequestContext } from "./plugins/requestContext";
import { v1Routes } from "./routes/v1";
import { ApiError } from "./shared/apiError";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          issues: error.issues
        }
      });
      return;
    }

    if (error instanceof ApiError) {
      reply.status(error.statusCode).send({
        error: {
          code: error.errorCode,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    const normalizedError = error instanceof Error ? error : new Error("Unknown error");
    const errorWithStatus = normalizedError as Error & { statusCode?: unknown };
    const statusCode = typeof errorWithStatus.statusCode === "number" ? errorWithStatus.statusCode : 500;
    request.log.error({ err: normalizedError }, "Unhandled API error");

    reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
        message: statusCode >= 500 ? "Unexpected server error." : normalizedError.message
      }
    });
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: parseCorsOrigin(env.CORS_ORIGIN),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"]
  });
  installRequestContext(app);

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(v1Routes, { prefix: "/v1" });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found."
      }
    });
  });

  return app;
}

function parseCorsOrigin(value: string): true | string[] {
  if (value === "*") {
    return true;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
