import { buildApp } from "./app";
import { env } from "./config/env";
import { closeMongo } from "./db/mongo";

async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down API");
    await app.close();
    await closeMongo();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
