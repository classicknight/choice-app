import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireMatchingAuthenticatedUser } from "../lib/auth.js";
import { applySystemPenalty } from "../lib/system-penalties.js";

const applySystemPenaltySchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1).max(120),
  contextKey: z.string().min(1).max(180),
  note: z.string().max(500).optional(),
});

export const moderationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/moderation/system-penalty", async (request, reply) => {
    const parsed = applySystemPenaltySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_SYSTEM_PENALTY",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    if (!requireMatchingAuthenticatedUser(request, reply, data.userId)) {
      return;
    }

    const result = await applySystemPenalty({
      userId: data.userId,
      reason: data.reason,
      contextKey: data.contextKey,
      note: data.note,
    });

    if (!result.ok) {
      return reply.status(404).send({
        error: "USER_NOT_FOUND",
      });
    }

    return reply.send({
      ok: true,
      applied: result.applied,
      account: result.account,
    });
  });
};
