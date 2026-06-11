import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const createReportSchema = z.object({
  reporterUserId: z.string().min(1),
  reportedUserId: z.string().min(1),
  matchId: z.string().min(1).optional(),
  reporterName: z.string().min(1).optional(),
  reportedName: z.string().min(1).optional(),
  reason: z.string().min(1),
  details: z.string().max(1_000).optional(),
  latestMessagePreview: z.string().max(500).optional(),
});

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.post("/reports", async (request, reply) => {
    const parsed = createReportSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REPORT",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    if (data.reporterUserId === data.reportedUserId) {
      return reply.status(400).send({
        error: "REPORT_SELF_NOT_ALLOWED",
      });
    }

    const [reporterUser, reportedUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: data.reporterUserId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: data.reportedUserId },
        select: { id: true },
      }),
    ]);

    if (!reporterUser || !reportedUser) {
      return reply.status(404).send({
        error: "USER_NOT_FOUND",
      });
    }

    if (data.matchId) {
      const match = await prisma.match.findUnique({
        where: { id: data.matchId },
        select: { id: true },
      });

      if (!match) {
        return reply.status(404).send({
          error: "MATCH_NOT_FOUND",
        });
      }
    }

    const report = await prisma.report.create({
      data: {
        reporterUserId: data.reporterUserId,
        reportedUserId: data.reportedUserId,
        matchId: data.matchId,
        reporterName: data.reporterName?.trim() || undefined,
        reportedName: data.reportedName?.trim() || undefined,
        reason: data.reason.trim(),
        details: data.details?.trim() || undefined,
        latestMessagePreview: data.latestMessagePreview?.trim() || undefined,
      },
    });

    return reply.status(201).send({
      ok: true,
      reportId: report.id,
    });
  });
};
