import Fastify from "fastify";
import cors from "@fastify/cors";
import { adminRoutes } from "./routes/admin.js";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { journeyRoutes } from "./routes/journey.js";
import { moderationRoutes } from "./routes/moderation.js";
import { pushRoutes } from "./routes/push.js";
import { profileRoutes } from "./routes/profiles.js";
import { reportRoutes } from "./routes/reports.js";
import { uploadRoutes } from "./routes/uploads.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development",
  });

  app.decorate("config", env);

  app.register(cors, {
    origin: true,
  });

  app.register(healthRoutes, { prefix: "/v1" });
  app.register(authRoutes, { prefix: "/v1" });
  app.register(journeyRoutes, { prefix: "/v1" });
  app.register(pushRoutes, { prefix: "/v1" });
  app.register(profileRoutes, { prefix: "/v1" });
  app.register(moderationRoutes, { prefix: "/v1" });
  app.register(reportRoutes, { prefix: "/v1" });
  app.register(uploadRoutes, { prefix: "/v1" });
  app.register(adminRoutes, { prefix: "/v1" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: typeof env;
  }
}
