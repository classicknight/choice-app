import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { mapAccountState } from "../lib/account-state.js";
import { prisma } from "../lib/prisma.js";

const profileSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().min(1),
  age: z.number().int().min(18).max(99),
  city: z.string().min(1),
  selfDescription: z.string().min(1),
  pronouns: z.string().min(1),
  identity: z.string().min(1),
  lookingFor: z.string().min(1),
  datingIntent: z.string().min(1),
  ageRangeMin: z.number().int().min(18).max(99),
  ageRangeMax: z.number().int().min(18).max(99),
  interests: z.array(z.string().min(1)).min(3).max(8),
  dealbreaker: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).min(2).max(3),
  introVideoUrl: z.string().url().optional(),
  matchTime: z.string().min(1),
  conversationStyle: z.string().min(1),
});

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profiles/:userId/account", async (request, reply) => {
    const params = z.object({
      userId: z.string().min(1),
    }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_USER_ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.data.userId },
      select: {
        id: true,
        isPremium: true,
        premiumActivatedAt: true,
        penaltyPoints: true,
        suspendedAt: true,
        bannedAt: true,
        paidMatchCredits: true,
        frozenPaidMatchCredits: true,
        forfeitedPaidMatchCredits: true,
        lastPaidMatchPackageAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: "USER_NOT_FOUND",
      });
    }

    return reply.send({
      ok: true,
      account: mapAccountState(user),
    });
  });

  app.get("/profiles/:userId", async (request, reply) => {
    const params = z.object({
      userId: z.string().min(1),
    }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_USER_ID",
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: params.data.userId },
    });

    if (!profile) {
      return reply.status(404).send({
        error: "PROFILE_NOT_FOUND",
      });
    }

    return reply.send({
      ok: true,
      profile,
    });
  });

  app.post("/profiles", async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PROFILE",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const profile = await prisma.profile.upsert({
      where: { userId: data.userId },
      update: {
        ...data,
      },
      create: {
        ...data,
      },
    });

    await prisma.user.update({
      where: { id: data.userId },
      data: {
        profileCompleted: true,
      },
    });

    return reply.status(201).send({
      ok: true,
      profileId: profile.id,
    });
  });

  app.delete("/profiles/:userId", async (request, reply) => {
    const params = z.object({
      userId: z.string().min(1),
    }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_USER_ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true },
    });

    if (!user) {
      return reply.status(404).send({
        error: "USER_NOT_FOUND",
      });
    }

    await prisma.user.delete({
      where: { id: params.data.userId },
    });

    return reply.send({
      ok: true,
    });
  });
};
