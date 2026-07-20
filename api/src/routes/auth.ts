import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { issueAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { generateOtpCode, hashOtpCode, normalizeEmail, normalizePhone } from "../services/verification.service.js";
import {
  checkTwilioPhoneVerification,
  isTwilioVerifyConfigured,
  sendTwilioPhoneVerification,
  TwilioVerifyError,
} from "../services/twilio-verify.service.js";

const emailStartSchema = z.object({
  email: z.string().email(),
});

const phoneStartSchema = z.object({
  phoneNumber: z.string().min(8),
});

const emailVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const phoneVerifySchema = z.object({
  phoneNumber: z.string().min(8),
  code: z.string().length(6),
});

const devSessionSchema = z.object({
  userId: z.string().min(1),
  phoneNumber: z.string().min(8),
});

const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

async function verifyLatestChallenge(target: string, channel: "EMAIL" | "PHONE", code: string) {
  const challenge = await prisma.verificationChallenge.findFirst({
    where: {
      target,
      channel,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge) {
    return {
      ok: false as const,
      reason: "NOT_FOUND",
    };
  }

  if (challenge.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    await prisma.verificationChallenge.update({
      where: { id: challenge.id },
      data: { status: "EXPIRED" },
    });

    return {
      ok: false as const,
      reason: "TOO_MANY_ATTEMPTS",
    };
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.verificationChallenge.update({
      where: { id: challenge.id },
      data: { status: "EXPIRED" },
    });

    return {
      ok: false as const,
      reason: "EXPIRED",
    };
  }

  if (challenge.codeHash !== hashOtpCode(code)) {
    if (challenge.attempts + 1 >= MAX_VERIFICATION_ATTEMPTS) {
      await prisma.verificationChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: {
            increment: 1,
          },
          status: "EXPIRED",
        },
      });

      return {
        ok: false as const,
        reason: "TOO_MANY_ATTEMPTS",
      };
    }

    await prisma.verificationChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    return {
      ok: false as const,
      reason: "INVALID_CODE",
    };
  }

  const updatedChallenge = await prisma.verificationChallenge.update({
    where: { id: challenge.id },
    data: {
      status: "VERIFIED",
    },
  });

  if (updatedChallenge.userId) {
    await prisma.user.update({
      where: { id: updatedChallenge.userId },
      data:
        channel === "PHONE"
          ? { phoneVerifiedAt: new Date() }
          : { emailVerifiedAt: new Date() },
    });
  }

  return {
    ok: true as const,
    userId: updatedChallenge.userId,
  };
}

async function getLatestPendingChallenge(target: string, channel: "EMAIL" | "PHONE") {
  return prisma.verificationChallenge.findFirst({
    where: {
      target,
      channel,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function ensureChallengeCanBeStarted(target: string, channel: "EMAIL" | "PHONE") {
  const latestChallenge = await getLatestPendingChallenge(target, channel);

  if (!latestChallenge) {
    return {
      ok: true as const,
    };
  }

  if (latestChallenge.expiresAt.getTime() < Date.now()) {
    await prisma.verificationChallenge.update({
      where: { id: latestChallenge.id },
      data: { status: "EXPIRED" },
    });

    return {
      ok: true as const,
    };
  }

  const retryAfterMs = (latestChallenge.lastSentAt?.getTime() ?? latestChallenge.createdAt.getTime()) + VERIFICATION_RESEND_COOLDOWN_MS - Date.now();

  if (retryAfterMs > 0) {
    return {
      ok: false as const,
      reason: "CHALLENGE_COOLDOWN_ACTIVE",
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  return {
    ok: true as const,
  };
}

async function invalidatePendingChallenges(target: string, channel: "EMAIL" | "PHONE") {
  await prisma.verificationChallenge.updateMany({
    where: {
      target,
      channel,
      status: "PENDING",
    },
    data: {
      status: "EXPIRED",
    },
  });
}

async function markChallengeInvalidAttempt(challengeId: string) {
  await prisma.verificationChallenge.update({
    where: { id: challengeId },
    data: {
      attempts: {
        increment: 1,
      },
    },
  });
}

async function markChallengeVerified(challengeId: string) {
  await prisma.verificationChallenge.update({
    where: { id: challengeId },
    data: {
      status: "VERIFIED",
    },
  });
}

async function verifyTwilioChallenge(target: string, code: string, app: Parameters<FastifyPluginAsync>[0]) {
  const challenge = await getLatestPendingChallenge(target, "PHONE");

  if (!challenge) {
    return {
      ok: false as const,
      reason: "NOT_FOUND",
    };
  }

  try {
    const result = await checkTwilioPhoneVerification(target, code, {
      accountSid: app.config.TWILIO_ACCOUNT_SID!,
      authToken: app.config.TWILIO_AUTH_TOKEN!,
      serviceSid: app.config.TWILIO_VERIFY_SERVICE_SID!,
    });

    if (!result.valid || result.status !== "approved") {
      if (challenge.attempts + 1 >= MAX_VERIFICATION_ATTEMPTS) {
        await prisma.verificationChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts: {
              increment: 1,
            },
            status: "EXPIRED",
          },
        });

        return {
          ok: false as const,
          reason: "TOO_MANY_ATTEMPTS",
        };
      }

      await markChallengeInvalidAttempt(challenge.id);

      return {
        ok: false as const,
        reason: "INVALID_CODE",
      };
    }

    await markChallengeVerified(challenge.id);

    if (challenge.userId) {
      await prisma.user.update({
        where: { id: challenge.userId },
        data: { phoneVerifiedAt: new Date() },
      });
    }

    return {
      ok: true as const,
      userId: challenge.userId,
    };
  } catch (error) {
    if (error instanceof TwilioVerifyError) {
      if (error.code === 20404 || error.status === 404) {
        return {
          ok: false as const,
          reason: "NOT_FOUND",
        };
      }

      if (error.code === 60202 || error.code === 60203 || error.code === 60212 || error.status === 400) {
        if (challenge.attempts + 1 >= MAX_VERIFICATION_ATTEMPTS) {
          await prisma.verificationChallenge.update({
            where: { id: challenge.id },
            data: {
              attempts: {
                increment: 1,
              },
              status: "EXPIRED",
            },
          });

          return {
            ok: false as const,
            reason: "TOO_MANY_ATTEMPTS",
          };
        }

        await markChallengeInvalidAttempt(challenge.id);

        return {
          ok: false as const,
          reason: "INVALID_CODE",
        };
      }
    }

    throw error;
  }
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/email/start", async (request, reply) => {
    const parsed = emailStartSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_EMAIL",
        details: parsed.error.flatten(),
      });
    }

    const email = normalizeEmail(parsed.data.email);
    const allowed = await ensureChallengeCanBeStarted(email, "EMAIL");

    if (!allowed.ok) {
      return reply.status(429).send({
        error: allowed.reason,
        retryAfterSeconds: allowed.retryAfterSeconds,
      });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true, email: true },
    });

    await invalidatePendingChallenges(email, "EMAIL");

    await prisma.verificationChallenge.create({
      data: {
        userId: user.id,
        channel: "EMAIL",
        purpose: "SIGN_UP",
        target: email,
        codeHash: hashOtpCode(code),
        expiresAt,
        lastSentAt: new Date(),
      },
    });

    return reply.status(201).send({
      ok: true,
      channel: "email",
      target: email,
      userId: user.id,
      verificationProvider: "pending-resend-integration",
      devCodePreview: app.config.NODE_ENV === "development" ? code : undefined,
    });
  });

  app.post("/auth/phone/start", async (request, reply) => {
    const parsed = phoneStartSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PHONE",
        details: parsed.error.flatten(),
      });
    }

    const phoneNumber = normalizePhone(parsed.data.phoneNumber);
    const allowed = await ensureChallengeCanBeStarted(phoneNumber, "PHONE");

    if (!allowed.ok) {
      return reply.status(429).send({
        error: allowed.reason,
        retryAfterSeconds: allowed.retryAfterSeconds,
      });
    }

    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    const user = await prisma.user.upsert({
      where: { phoneNumber },
      update: {},
      create: { phoneNumber },
      select: { id: true, phoneNumber: true, profileCompleted: true },
    });

    let devCodePreview: string | undefined;
    let verificationProvider = "twilio-verify";
    let codeHash = "twilio-managed";

    if (isTwilioVerifyConfigured({
      accountSid: app.config.TWILIO_ACCOUNT_SID,
      authToken: app.config.TWILIO_AUTH_TOKEN,
      serviceSid: app.config.TWILIO_VERIFY_SERVICE_SID,
    })) {
      await sendTwilioPhoneVerification(phoneNumber, {
        accountSid: app.config.TWILIO_ACCOUNT_SID!,
        authToken: app.config.TWILIO_AUTH_TOKEN!,
        serviceSid: app.config.TWILIO_VERIFY_SERVICE_SID!,
      });
    } else {
      const code = generateOtpCode();
      codeHash = hashOtpCode(code);
      verificationProvider = "dev-local-fallback";
      devCodePreview = app.config.NODE_ENV === "development" ? code : undefined;
    }

    await invalidatePendingChallenges(phoneNumber, "PHONE");

    await prisma.verificationChallenge.create({
      data: {
        userId: user.id,
        channel: "PHONE",
        purpose: "SIGN_UP",
        target: phoneNumber,
        codeHash,
        expiresAt,
        lastSentAt: new Date(),
      },
    });

    return reply.status(201).send({
      ok: true,
      channel: "phone",
      target: phoneNumber,
      userId: user.id,
      profileCompleted: user.profileCompleted,
      verificationProvider,
      devCodePreview,
    });
  });

  app.post("/auth/email/verify", async (request, reply) => {
    const parsed = emailVerifySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_EMAIL_VERIFICATION",
        details: parsed.error.flatten(),
      });
    }

    const result = await verifyLatestChallenge(normalizeEmail(parsed.data.email), "EMAIL", parsed.data.code);

    if (!result.ok) {
      return reply.status(result.reason === "TOO_MANY_ATTEMPTS" ? 429 : 400).send({
        error: result.reason,
      });
    }

    if (!result.userId) {
      return reply.status(500).send({
        error: "USER_NOT_FOUND",
      });
    }

    return reply.send({
      ok: true,
      verified: true,
      userId: result.userId,
      accessToken: issueAccessToken(result.userId, app.config.JWT_ACCESS_SECRET),
    });
  });

  app.post("/auth/phone/verify", async (request, reply) => {
    const parsed = phoneVerifySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PHONE_VERIFICATION",
        details: parsed.error.flatten(),
      });
    }

    const normalizedPhone = normalizePhone(parsed.data.phoneNumber);
    const result = isTwilioVerifyConfigured({
      accountSid: app.config.TWILIO_ACCOUNT_SID,
      authToken: app.config.TWILIO_AUTH_TOKEN,
      serviceSid: app.config.TWILIO_VERIFY_SERVICE_SID,
    })
      ? await verifyTwilioChallenge(normalizedPhone, parsed.data.code, app)
      : await verifyLatestChallenge(normalizedPhone, "PHONE", parsed.data.code);

    if (!result.ok) {
      return reply.status(result.reason === "TOO_MANY_ATTEMPTS" ? 429 : 400).send({
        error: result.reason,
      });
    }

    if (!result.userId) {
      return reply.status(500).send({
        error: "USER_NOT_FOUND",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { profileCompleted: true },
    });

    return reply.send({
      ok: true,
      verified: true,
      userId: result.userId,
      profileCompleted: user?.profileCompleted ?? false,
      accessToken: issueAccessToken(result.userId, app.config.JWT_ACCESS_SECRET),
    });
  });

  app.post("/auth/dev/session", async (request, reply) => {
    if (app.config.NODE_ENV !== "development") {
      return reply.status(403).send({
        error: "DEV_AUTH_DISABLED",
      });
    }

    const parsed = devSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_DEV_SESSION",
        details: parsed.error.flatten(),
      });
    }

    const normalizedPhone = normalizePhone(parsed.data.phoneNumber);
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        phoneNumber: true,
        profileCompleted: true,
      },
    });

    if (!user || user.phoneNumber !== normalizedPhone) {
      return reply.status(404).send({
        error: "DEV_SESSION_NOT_FOUND",
      });
    }

    return reply.send({
      ok: true,
      userId: user.id,
      target: normalizedPhone,
      profileCompleted: user.profileCompleted,
      accessToken: issueAccessToken(user.id, app.config.JWT_ACCESS_SECRET),
    });
  });
};
