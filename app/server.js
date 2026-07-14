import cookieParser from "cookie-parser";
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

  // The app is otherwise cookie-free — the JWT lives in localStorage, because the
  // /mcp page has to show it to the user. This is here for exactly one thing: the
  // OAuth `state` nonce, which must be httpOnly and must survive Google's
  // redirect, and therefore cannot live in localStorage.
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok", env: config.env });
  });

  const { api, redirect } = buildRoutes(container.controllers, {
    google: container.services.googleAuthService,
  });

  app.use("/api", api);
  app.use("/", redirect); // last — matches /:code

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
