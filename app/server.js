import cors from "cors";
import express from "express";
import config from "./config/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import buildRoutes from "./routes/index.js";

/**
 * App factory. Kept separate from index.js so a test can build an app against a
 * container full of fakes and drive it with supertest, without opening a port or
 * connecting to Postgres.
 */
export default function createApp(container) {
  const app = express();

  app.set("trust proxy", 1); // behind nginx in the Docker stack

  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok", env: config.env });
  });

  const { api, redirect } = buildRoutes(container.controllers);

  app.use("/api", api);
  app.use("/", redirect); // last — matches /:code

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
