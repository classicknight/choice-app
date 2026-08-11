import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { MatchStatus } from "@prisma/client";
import { z } from "zod";
import { issueAccessToken, requireMatchingAuthenticatedUser } from "../lib/auth.js";
import {
  blockJourneyPartner,
  createJourneyMessage,
  getCurrentJourneyForUser,
  getJourneyEncountersForUser,
  goBackPhaseTwoQuestionForUser,
  setPhaseOneDecision,
  setPhaseThreeDecision,
  startPhaseTwoForUser,
  submitPhaseTwoAnswer,
} from "../lib/journey.js";
import { prisma } from "../lib/prisma.js";
import { isPrivateQaAccountEmail } from "../lib/synthetic-accounts.js";

const paramsSchema = z.object({
  userId: z.string().trim().min(1),
});

const createMessageSchema = z.object({
  kind: z.enum(["text", "image"]),
  text: z.string().trim().min(1).max(4_000).optional(),
  imageUri: z.string().trim().url().max(4_000).optional(),
});

const phaseOneDecisionSchema = z.object({
  decision: z.enum(["continue", "new-match"]),
});

const phaseTwoAnswerSchema = z.object({
  stage: z.enum(["starter", "partner"]),
  roundIndex: z.number().int().min(0),
  optionIndex: z.number().int().min(0),
});

const phaseThreeDecisionSchema = z.object({
  decision: z.enum(["stay", "new-match"]),
});

const blockPartnerSchema = z.object({
  blockedUserId: z.string().trim().min(1),
});

const privateQaPartnerSessionSchema = z.object({
  partnerUserId: z.string().trim().min(1),
});

function getPrivateQaOwnerUserId(rationale: unknown) {
  if (!rationale || typeof rationale !== "object" || Array.isArray(rationale)) {
    return null;
  }

  const record = rationale as Record<string, unknown>;

  return record.generatedBy === "private-qa-match" && typeof record.ownerUserId === "string"
    ? record.ownerUserId
    : null;
}

function sendJourneyError(reply: FastifyReply, reason: string) {
  const status =
    reason === "USER_NOT_FOUND" || reason === "MATCH_NOT_FOUND"
      ? 404
      : reason === "INVALID_MESSAGE"
        || reason === "INVALID_PHASE_TWO_STAGE"
        || reason === "INVALID_PHASE_TWO_ROUND"
        || reason === "INVALID_PHASE_TWO_OPTION"
        || reason === "PHASE_TWO_STARTER_PENDING"
        || reason === "REPORT_SELF_NOT_ALLOWED"
        || reason === "CONTACT_SHARING_NOT_ALLOWED"
        || reason === "OBJECTIONABLE_CONTENT"
        || reason === "INVALID_BLOCK_TARGET"
          ? 400
          : reason === "NOT_YOUR_TURN"
            ? 403
            : 409;

  return reply.status(status).send({ error: reason });
}

export const journeyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/journey/:userId", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "INVALID_JOURNEY_PARAMS",
        details: parsedParams.error.flatten(),
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const journey = await getCurrentJourneyForUser(parsedParams.data.userId);
    return reply.send({ ok: true, journey });
  });

  app.get("/journey/:userId/encounters", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "INVALID_JOURNEY_PARAMS",
        details: parsedParams.error.flatten(),
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const encounters = await getJourneyEncountersForUser(parsedParams.data.userId);
    return reply.send({ ok: true, encounters });
  });

  app.post("/journey/:userId/private-qa-partner-session", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = privateQaPartnerSessionSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "INVALID_PRIVATE_QA_PARTNER_SESSION",
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    const ownerUserId = parsedParams.data.userId;

    if (!requireMatchingAuthenticatedUser(request, reply, ownerUserId)) {
      return;
    }

    const partnerUserId = parsedBody.data.partnerUserId;
    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { userAId: ownerUserId, userBId: partnerUserId },
          { userAId: partnerUserId, userBId: ownerUserId },
        ],
        status: { in: [MatchStatus.PENDING, MatchStatus.ACTIVE, MatchStatus.KEPT] },
        closedAt: null,
      },
      include: {
        userA: { select: { email: true, profileCompleted: true } },
        userB: { select: { email: true, profileCompleted: true } },
      },
    });

    if (!match || getPrivateQaOwnerUserId(match.rationale) !== ownerUserId) {
      return reply.status(404).send({ error: "PRIVATE_QA_MATCH_NOT_FOUND" });
    }

    const partner = match.userAId === partnerUserId ? match.userA : match.userB;

    if (!isPrivateQaAccountEmail(partner.email)) {
      return reply.status(403).send({ error: "PRIVATE_QA_PARTNER_REQUIRED" });
    }

    return reply.send({
      ok: true,
      userId: partnerUserId,
      phoneNumber: null,
      profileCompleted: partner.profileCompleted,
      accessToken: issueAccessToken(partnerUserId, app.config.JWT_ACCESS_SECRET),
    });
  });

  app.post("/journey/:userId/messages", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = createMessageSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "INVALID_JOURNEY_MESSAGE",
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await createJourneyMessage({
      userId: parsedParams.data.userId,
      kind: parsedBody.data.kind,
      text: parsedBody.data.text,
      imageUri: parsedBody.data.imageUri,
    });

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.status(201).send(result);
  });

  app.post("/journey/:userId/phase-one-decision", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = phaseOneDecisionSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "INVALID_PHASE_ONE_DECISION",
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await setPhaseOneDecision({
      userId: parsedParams.data.userId,
      decision: parsedBody.data.decision,
    });

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });

  app.post("/journey/:userId/phase-two/start", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "INVALID_PHASE_TWO_START",
        details: parsedParams.error.flatten(),
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await startPhaseTwoForUser(parsedParams.data.userId);

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });

  app.post("/journey/:userId/phase-two/answer", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = phaseTwoAnswerSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "INVALID_PHASE_TWO_ANSWER",
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await submitPhaseTwoAnswer({
      userId: parsedParams.data.userId,
      stage: parsedBody.data.stage,
      roundIndex: parsedBody.data.roundIndex,
      optionIndex: parsedBody.data.optionIndex,
    });

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });

  app.post("/journey/:userId/phase-two/back", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "INVALID_PHASE_TWO_BACK",
        details: parsedParams.error.flatten(),
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await goBackPhaseTwoQuestionForUser(parsedParams.data.userId);

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });

  app.post("/journey/:userId/phase-three-decision", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = phaseThreeDecisionSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "INVALID_PHASE_THREE_DECISION",
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await setPhaseThreeDecision({
      userId: parsedParams.data.userId,
      decision: parsedBody.data.decision,
    });

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });

  app.post("/journey/:userId/block", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = blockPartnerSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "INVALID_BLOCK_REQUEST",
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    if (!requireMatchingAuthenticatedUser(request, reply, parsedParams.data.userId)) {
      return;
    }

    const result = await blockJourneyPartner({
      userId: parsedParams.data.userId,
      blockedUserId: parsedBody.data.blockedUserId,
    });

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });
};
