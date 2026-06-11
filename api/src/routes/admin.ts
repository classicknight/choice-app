import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminAccess } from "../lib/admin-auth.js";
import { prisma } from "../lib/prisma.js";

const updateUserSchema = z.object({
  isPremium: z.boolean().optional(),
  penaltyPoints: z.number().int().min(0).max(3).optional(),
  suspended: z.boolean().optional(),
});

const resolveReportSchema = z.object({
  decision: z.enum(["confirmed", "dismissed"]),
  reviewerNote: z.string().max(1_000).optional(),
});

type UserSummaryRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string | null;
  phoneNumber: string | null;
  profileCompleted: boolean;
  isPremium: boolean;
  premiumActivatedAt: Date | null;
  penaltyPoints: number;
  suspendedAt: Date | null;
  profile: {
    firstName: string;
    city: string;
  } | null;
  matchesAsA: Array<{ id: string }>;
  matchesAsB: Array<{ id: string }>;
};

function mapUserSummary(user: UserSummaryRow) {
  return {
    id: user.id,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    firstName: user.profile?.firstName ?? null,
    city: user.profile?.city ?? null,
    phoneNumber: user.phoneNumber,
    email: user.email,
    profileCompleted: user.profileCompleted,
    isPremium: user.isPremium,
    premiumActivatedAt: user.premiumActivatedAt,
    penaltyPoints: user.penaltyPoints,
    suspendedAt: user.suspendedAt,
    accountPaused: user.penaltyPoints >= 3 || Boolean(user.suspendedAt),
    matchCount: user.matchesAsA.length + user.matchesAsB.length,
  };
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/overview", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    const [users, matches, reports] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          profile: true,
          matchesAsA: {
            select: { id: true },
          },
          matchesAsB: {
            select: { id: true },
          },
        },
      }),
      prisma.match.findMany({
        orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
        include: {
          userA: {
            include: {
              profile: true,
            },
          },
          userB: {
            include: {
              profile: true,
            },
          },
        },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            include: {
              profile: true,
            },
          },
          reportedUser: {
            include: {
              profile: true,
            },
          },
          match: true,
        },
      }),
    ]);

    const userSummaries = users.map(mapUserSummary);

    return reply.send({
      ok: true,
      summary: {
        totalUsers: users.length,
        completedProfiles: users.filter((user) => user.profileCompleted).length,
        premiumUsers: users.filter((user) => user.isPremium).length,
        pausedUsers: users.filter((user) => user.penaltyPoints >= 3 || user.suspendedAt).length,
        openReports: reports.filter((report) => report.status === "OPEN").length,
        activeMatches: matches.filter((match) => match.status === "ACTIVE").length,
      },
      users: userSummaries,
      matches: matches.map((match) => ({
        id: match.id,
        status: match.status,
        scheduledFor: match.scheduledFor,
        activatedAt: match.activatedAt,
        closedAt: match.closedAt,
        compatibility: match.compatibility,
        userADecision: match.userADecision,
        userBDecision: match.userBDecision,
        rationale: match.rationale,
        userA: {
          id: match.userA.id,
          firstName: match.userA.profile?.firstName ?? null,
          city: match.userA.profile?.city ?? null,
          phoneNumber: match.userA.phoneNumber,
        },
        userB: {
          id: match.userB.id,
          firstName: match.userB.profile?.firstName ?? null,
          city: match.userB.profile?.city ?? null,
          phoneNumber: match.userB.phoneNumber,
        },
      })),
      reports: reports.map((report) => ({
        id: report.id,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        status: report.status,
        reason: report.reason,
        details: report.details,
        latestMessagePreview: report.latestMessagePreview,
        reviewerNote: report.reviewerNote,
        reviewedAt: report.reviewedAt,
        reporter: {
          id: report.reporter.id,
          firstName: report.reporterName ?? report.reporter.profile?.firstName ?? null,
          phoneNumber: report.reporter.phoneNumber,
        },
        reportedUser: {
          id: report.reportedUser.id,
          firstName: report.reportedName ?? report.reportedUser.profile?.firstName ?? null,
          phoneNumber: report.reportedUser.phoneNumber,
          penaltyPoints: report.reportedUser.penaltyPoints,
          suspendedAt: report.reportedUser.suspendedAt,
        },
        matchId: report.matchId,
      })),
    });
  });

  app.patch("/admin/users/:userId", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    const params = z.object({ userId: z.string().min(1) }).safeParse(request.params);
    const parsed = updateUserSchema.safeParse(request.body);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_ADMIN_USER_UPDATE",
        details: params.error.flatten(),
      });
    }

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_ADMIN_USER_UPDATE",
        details: parsed.error.flatten(),
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true, isPremium: true, premiumActivatedAt: true, penaltyPoints: true, suspendedAt: true },
    });

    if (!existingUser) {
      return reply.status(404).send({
        error: "USER_NOT_FOUND",
      });
    }

    const nextPenaltyPoints = parsed.data.penaltyPoints ?? existingUser.penaltyPoints;
    const nextSuspended =
      parsed.data.suspended !== undefined ? parsed.data.suspended : nextPenaltyPoints >= 3 || Boolean(existingUser.suspendedAt);

    const updatedUser = await prisma.user.update({
      where: { id: params.data.userId },
      data: {
        isPremium: parsed.data.isPremium ?? existingUser.isPremium,
        premiumActivatedAt:
          parsed.data.isPremium === undefined
            ? existingUser.premiumActivatedAt
            : parsed.data.isPremium
              ? existingUser.premiumActivatedAt ?? new Date()
              : null,
        penaltyPoints: nextPenaltyPoints,
        suspendedAt: nextSuspended ? existingUser.suspendedAt ?? new Date() : null,
      },
      include: {
        profile: true,
        matchesAsA: {
          select: { id: true },
        },
        matchesAsB: {
          select: { id: true },
        },
      },
    });

    return reply.send({
      ok: true,
      user: mapUserSummary(updatedUser),
    });
  });

  app.post("/admin/reports/:reportId/resolve", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    const params = z.object({ reportId: z.string().min(1) }).safeParse(request.params);
    const parsed = resolveReportSchema.safeParse(request.body);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_REPORT_RESOLUTION",
        details: params.error.flatten(),
      });
    }

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REPORT_RESOLUTION",
        details: parsed.error.flatten(),
      });
    }

    const report = await prisma.report.findUnique({
      where: { id: params.data.reportId },
      include: {
        reportedUser: true,
      },
    });

    if (!report) {
      return reply.status(404).send({
        error: "REPORT_NOT_FOUND",
      });
    }

    if (report.status !== "OPEN") {
      return reply.status(400).send({
        error: "REPORT_ALREADY_RESOLVED",
      });
    }

    const shouldConfirm = parsed.data.decision === "confirmed";
    const nextPenaltyPoints = shouldConfirm ? Math.min(report.reportedUser.penaltyPoints + 1, 3) : report.reportedUser.penaltyPoints;

    const [updatedReport] = await prisma.$transaction([
      prisma.report.update({
        where: { id: report.id },
        data: {
          status: shouldConfirm ? "CONFIRMED" : "DISMISSED",
          reviewerNote: parsed.data.reviewerNote?.trim() || null,
          reviewedAt: new Date(),
        },
      }),
      shouldConfirm
        ? prisma.user.update({
            where: { id: report.reportedUserId },
            data: {
              penaltyPoints: nextPenaltyPoints,
              suspendedAt: nextPenaltyPoints >= 3 ? report.reportedUser.suspendedAt ?? new Date() : report.reportedUser.suspendedAt,
            },
          })
        : prisma.user.findUnique({
            where: { id: report.reportedUserId },
          }),
    ]);

    return reply.send({
      ok: true,
      report: updatedReport,
    });
  });

  app.delete("/admin/users/:userId", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    const params = z.object({ userId: z.string().min(1) }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_USER_ID",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true },
    });

    if (!existingUser) {
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
