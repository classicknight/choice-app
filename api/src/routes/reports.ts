import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireMatchingAuthenticatedUser } from "../lib/auth.js";
import { sendNewReportAlert } from "../lib/moderation-alerts.js";
import { prisma } from "../lib/prisma.js";

function getReportUserLabel(
  user: {
    phoneNumber?: string | null;
    profile?: {
      firstName?: string | null;
    } | null;
  },
  explicitName?: string,
) {
  return explicitName?.trim() || user.profile?.firstName || user.phoneNumber || "Unbekannt";
}

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

    if (!requireMatchingAuthenticatedUser(request, reply, data.reporterUserId)) {
      return;
    }

    if (data.reporterUserId === data.reportedUserId) {
      return reply.status(400).send({
        error: "REPORT_SELF_NOT_ALLOWED",
      });
    }

    const [reporterUser, reportedUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: data.reporterUserId },
        select: {
          id: true,
          phoneNumber: true,
          profile: {
            select: {
              firstName: true,
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: data.reportedUserId },
        select: {
          id: true,
          phoneNumber: true,
          profile: {
            select: {
              firstName: true,
            },
          },
        },
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
        select: {
          id: true,
          userAId: true,
          userBId: true,
        },
      });

      if (!match) {
        return reply.status(404).send({
          error: "MATCH_NOT_FOUND",
        });
      }

      const participantIds = [match.userAId, match.userBId];

      if (!participantIds.includes(data.reporterUserId) || !participantIds.includes(data.reportedUserId)) {
        return reply.status(403).send({
          error: "REPORT_MATCH_MISMATCH",
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

    const alertResult = await sendNewReportAlert({
      adminDashboardUrl: request.server.config.ADMIN_DASHBOARD_URL,
      apiKey: request.server.config.RESEND_API_KEY,
      createdAt: report.createdAt,
      details: report.details,
      fromEmail: request.server.config.EMAIL_FROM,
      latestMessagePreview: report.latestMessagePreview,
      logger: request.log,
      matchId: report.matchId,
      reason: report.reason,
      recipientsRaw: request.server.config.MODERATION_ALERT_EMAILS,
      reportId: report.id,
      reportedLabel: getReportUserLabel(reportedUser, data.reportedName),
      reporterLabel: getReportUserLabel(reporterUser, data.reporterName),
    });

    if (alertResult.sent) {
      await prisma.report.update({
        where: { id: report.id },
        data: {
          moderationAlertSentAt: new Date(),
        },
      });
    }

    return reply.status(201).send({
      ok: true,
      reportId: report.id,
    });
  });
};
