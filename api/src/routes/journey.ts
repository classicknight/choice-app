import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createJourneyMessage,
  getCurrentJourneyForUser,
  setPhaseOneDecision,
  setPhaseThreeDecision,
  startPhaseTwoForUser,
  submitPhaseTwoAnswer,
} from "../lib/journey.js";

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

    const journey = await getCurrentJourneyForUser(parsedParams.data.userId);
    return reply.send({ ok: true, journey });
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

    const result = await setPhaseThreeDecision({
      userId: parsedParams.data.userId,
      decision: parsedBody.data.decision,
    });

    if (!result.ok) {
      return sendJourneyError(reply, result.reason);
    }

    return reply.send(result);
  });
};
