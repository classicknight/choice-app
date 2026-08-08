import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireMatchingAuthenticatedUser } from "../lib/auth.js";
import { registerPushDevice, unregisterPushDevice } from "../lib/push-notifications.js";

const registerPushDeviceSchema = z.object({
  userId: z.string().trim().min(1),
  token: z.string().trim().min(1).max(300),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

const unregisterPushDeviceSchema = registerPushDeviceSchema.pick({
  userId: true,
  token: true,
});

export const pushRoutes: FastifyPluginAsync = async (app) => {
  app.post("/push/register", async (request, reply) => {
    const parsed = registerPushDeviceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PUSH_DEVICE",
        details: parsed.error.flatten(),
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsed.data.userId)) {
      return;
    }

    const result = await registerPushDevice(parsed.data);

    if (!result.ok) {
      return reply.status(400).send({
        error: result.reason,
      });
    }

    return reply.send({
      ok: true,
    });
  });

  app.post("/push/unregister", async (request, reply) => {
    const parsed = unregisterPushDeviceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PUSH_DEVICE",
        details: parsed.error.flatten(),
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsed.data.userId)) {
      return;
    }

    await unregisterPushDevice(parsed.data);

    return reply.send({
      ok: true,
    });
  });
};
