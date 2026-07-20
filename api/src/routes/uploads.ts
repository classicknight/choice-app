import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../lib/auth.js";

const cloudinarySignSchema = z.object({
  folder: z.string().trim().min(1).max(120).optional(),
});

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post("/uploads/cloudinary/sign", async (request, reply) => {
    const authenticatedUserId = requireAuthenticatedUser(request, reply);

    if (!authenticatedUserId) {
      return;
    }

    const parsed = cloudinarySignSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_UPLOAD_REQUEST",
        details: parsed.error.flatten(),
      });
    }

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = app.config;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return reply.status(503).send({
        error: "UPLOADS_NOT_CONFIGURED",
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `choice/profiles/${authenticatedUserId}`;
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = createHash("sha1").update(signatureBase).digest("hex");

    return reply.send({
      ok: true,
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature,
    });
  });
};
