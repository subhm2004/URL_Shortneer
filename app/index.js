import config, { assertConfigValid } from "./config/index.js";
import { buildContainer } from "./container.js";
import logger from "./core/logger.js";
import { closeDB, connectDB } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import createApp from "./server.js";

async function main() {
  // Fails here, at boot, rather than at the first request that needs the var.
  assertConfigValid();

  await connectDB();
  await migrate();

  const container = buildContainer();
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    logger.info(`Server listening on http://localhost:${config.port}`, {
      env: config.env,
      baseUrl: config.baseUrl,
    });
  });

  // Finish in-flight requests and close the pool before exiting, so Postgres
  // isn't left holding connections open after a container restart.
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Failed to start", { error: err.message, stack: err.stack });
  process.exit(1);
});
