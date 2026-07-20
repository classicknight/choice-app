import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildBanAccountData, buildPauseAccountData, buildRestorePausedAccountData, isAccountPaused, mapAccountState } from "../lib/account-state.js";
import { getAuthenticatedAdminPhone, requireAdminAccess } from "../lib/admin-auth.js";
import { reconcileAllPenaltyStates, reconcileUserPenaltyState } from "../lib/penalty-state.js";
import { sendPushNotificationToUser } from "../lib/push-notifications.js";
import { prisma } from "../lib/prisma.js";

const updateUserSchema = z.object({
  isPremium: z.boolean().optional(),
  penaltyPoints: z.number().int().min(0).max(3).optional(),
  suspended: z.boolean().optional(),
  banned: z.boolean().optional(),
});

const manageMatchAccessSchema = z.object({
  action: z.enum(["grant_pack", "freeze_paid", "restore_frozen", "forfeit_paid", "ban_account"]),
});

const resolveReportSchema = z.object({
  decision: z.enum(["confirmed", "dismissed"]),
  reviewerNote: z.string().max(1_000).optional(),
});

const startReviewSchema = z.object({
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
  penaltySuspendedAt: Date | null;
  bannedAt: Date | null;
  paidMatchCredits: number;
  frozenPaidMatchCredits: number;
  forfeitedPaidMatchCredits: number;
  lastPaidMatchPackageAt: Date | null;
  profile?: {
    firstName: string;
    city: string;
  } | null;
  matchesAsA?: Array<{ id: string }>;
  matchesAsB?: Array<{ id: string }>;
};

function mapUserSummary(user: UserSummaryRow) {
  const account = mapAccountState(user);

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
    penaltySuspendedAt: user.penaltySuspendedAt,
    bannedAt: user.bannedAt,
    accountPaused: account.accountPaused,
    accountBanned: account.accountBanned,
    matchCount: (user.matchesAsA?.length ?? 0) + (user.matchesAsB?.length ?? 0),
    paidMatchCredits: user.paidMatchCredits,
    frozenPaidMatchCredits: user.frozenPaidMatchCredits,
    forfeitedPaidMatchCredits: user.forfeitedPaidMatchCredits,
    lastPaidMatchPackageAt: user.lastPaidMatchPackageAt,
  };
}

function resolveNumericField(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function getMatchParticipantLabel(match: {
  userAId: string;
  userBId: string;
  userA: { profile?: { firstName: string } | null; phoneNumber: string | null };
  userB: { profile?: { firstName: string } | null; phoneNumber: string | null };
}, userId: string) {
  if (match.userAId === userId) {
    return match.userA.profile?.firstName ?? match.userA.phoneNumber ?? "User A";
  }

  if (match.userBId === userId) {
    return match.userB.profile?.firstName ?? match.userB.phoneNumber ?? "User B";
  }

  return "Unbekannt";
}

function getAdminUserLabel(
  user: { profile?: { firstName: string } | null; phoneNumber: string | null },
  explicitName?: string | null,
) {
  return explicitName?.trim() || user.profile?.firstName || user.phoneNumber || "Unbekannt";
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/overview", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    await reconcileAllPenaltyStates();

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
          match: {
            include: {
              chat: {
                include: {
                  messages: {
                    orderBy: { createdAt: "asc" },
                    include: {
                      sender: {
                        include: {
                          profile: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const userSummaries = users.map(mapUserSummary);
    const now = new Date();
    const unresolvedReports = reports.filter((report) => report.status === "OPEN" || report.status === "IN_REVIEW");
    const reportSlaMs = 24 * 60 * 60 * 1000;
    const upcomingMatches = matches.filter((match) => match.status === "PENDING" && match.scheduledFor >= now);
    const nextPlannedReleaseAt = upcomingMatches
      .map((match) => match.scheduledFor.getTime())
      .sort((left, right) => left - right)[0] ?? null;
    const nextPlannedMatches = nextPlannedReleaseAt === null
      ? []
      : upcomingMatches.filter((match) => match.scheduledFor.getTime() === nextPlannedReleaseAt);
    const mapMatch = (match: (typeof matches)[number]) => ({
      id: match.id,
      status: match.status,
      scheduledFor: match.scheduledFor,
      activatedAt: match.activatedAt,
      closedAt: match.closedAt,
      compatibility: match.compatibility,
      phaseOneStarterUserId: match.phaseOneStarterUserId,
      phaseOneStarterName: match.phaseOneStarterUserId ? getMatchParticipantLabel(match, match.phaseOneStarterUserId) : null,
      phaseTwoStage: match.phaseTwoStage,
      phaseTwoStarterUserId: match.phaseTwoStarterUserId,
      phaseTwoStarterName: match.phaseTwoStarterUserId ? getMatchParticipantLabel(match, match.phaseTwoStarterUserId) : null,
      phaseTwoPartnerUserId: match.phaseTwoPartnerUserId,
      phaseTwoPartnerName: match.phaseTwoPartnerUserId ? getMatchParticipantLabel(match, match.phaseTwoPartnerUserId) : null,
      userADecision: match.userADecision,
      userBDecision: match.userBDecision,
      phaseThreeUserADecision: match.phaseThreeUserADecision,
      phaseThreeUserBDecision: match.phaseThreeUserBDecision,
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
    });

    return reply.send({
      ok: true,
      summary: {
        totalUsers: users.length,
        completedProfiles: users.filter((user) => user.profileCompleted).length,
        premiumUsers: users.filter((user) => user.isPremium).length,
        payingUsers: users.filter((user) => user.paidMatchCredits > 0 || user.frozenPaidMatchCredits > 0 || user.forfeitedPaidMatchCredits > 0 || user.isPremium).length,
        pausedUsers: users.filter((user) => isAccountPaused(user)).length,
        openReports: unresolvedReports.length,
        reportsInReview: reports.filter((report) => report.status === "IN_REVIEW").length,
        overdueReports: unresolvedReports.filter((report) => now.getTime() - report.createdAt.getTime() > reportSlaMs).length,
        activeMatches: matches.filter((match) => match.status === "ACTIVE").length,
        upcomingMatches: upcomingMatches.length,
        nextPlannedMatches: nextPlannedMatches.length,
      },
      users: userSummaries,
      matches: matches.map(mapMatch),
      upcomingMatches: upcomingMatches.map(mapMatch),
      nextPlannedReleaseAt: nextPlannedReleaseAt ? new Date(nextPlannedReleaseAt) : null,
      nextPlannedMatches: nextPlannedMatches.map(mapMatch),
      reports: reports.map((report) => ({
        chatTranscript: (report.match?.chat?.messages ?? []).map((message) => {
          const reporterLabel = getAdminUserLabel(report.reporter, report.reporterName);
          const reportedLabel = getAdminUserLabel(report.reportedUser, report.reportedName);
          const senderLabel =
            message.kind === "SYSTEM"
              ? "Choice"
              : message.senderId === report.reporter.id
                ? reporterLabel
                : message.senderId === report.reportedUser.id
                  ? reportedLabel
                  : getAdminUserLabel(message.sender);
          const senderRole =
            message.kind === "SYSTEM"
              ? "system"
              : message.senderId === report.reporter.id
                ? "reporter"
                : message.senderId === report.reportedUser.id
                  ? "reported"
                  : "other";

          return {
            id: message.id,
            createdAt: message.createdAt,
            kind: message.kind,
            body: message.body,
            senderUserId: message.senderId,
            senderLabel,
            senderRole,
          };
        }),
        id: report.id,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        status: report.status,
        reason: report.reason,
        details: report.details,
        latestMessagePreview: report.latestMessagePreview,
        reviewStartedAt: report.reviewStartedAt,
        reviewStartedByAdminPhone: report.reviewStartedByAdminPhone,
        reviewerNote: report.reviewerNote,
        reviewedAt: report.reviewedAt,
        reviewedByAdminPhone: report.reviewedByAdminPhone,
        moderationAlertSentAt: report.moderationAlertSentAt,
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
          bannedAt: report.reportedUser.bannedAt,
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
      select: {
        id: true,
        isPremium: true,
        premiumActivatedAt: true,
        penaltyPoints: true,
        suspendedAt: true,
        penaltySuspendedAt: true,
        bannedAt: true,
        paidMatchCredits: true,
        frozenPaidMatchCredits: true,
        forfeitedPaidMatchCredits: true,
        lastPaidMatchPackageAt: true,
      },
    });

    if (!existingUser) {
      return reply.status(404).send({
        error: "USER_NOT_FOUND",
      });
    }

    const nextPenaltyPoints = parsed.data.penaltyPoints ?? existingUser.penaltyPoints;
    const nextSuspended =
      parsed.data.suspended !== undefined ? parsed.data.suspended : nextPenaltyPoints >= 3 || Boolean(existingUser.suspendedAt);
    const nextBanned = parsed.data.banned !== undefined ? parsed.data.banned : Boolean(existingUser.bannedAt);
    const matchAccessData = nextBanned
      ? buildBanAccountData(existingUser)
      : nextSuspended
        ? buildPauseAccountData(existingUser)
        : buildRestorePausedAccountData(existingUser);
    const nextPaidMatchCredits = resolveNumericField(
      "paidMatchCredits" in matchAccessData ? matchAccessData.paidMatchCredits : undefined,
      existingUser.paidMatchCredits,
    );
    const nextFrozenPaidMatchCredits = resolveNumericField(
      "frozenPaidMatchCredits" in matchAccessData ? matchAccessData.frozenPaidMatchCredits : undefined,
      existingUser.frozenPaidMatchCredits,
    );
    const nextForfeitedPaidMatchCredits = resolveNumericField(
      "forfeitedPaidMatchCredits" in matchAccessData ? matchAccessData.forfeitedPaidMatchCredits : undefined,
      existingUser.forfeitedPaidMatchCredits,
    );

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
        suspendedAt: nextBanned ? existingUser.suspendedAt ?? new Date() : nextSuspended ? existingUser.suspendedAt ?? new Date() : null,
        penaltySuspendedAt: nextBanned ? null : nextPenaltyPoints >= 3 ? existingUser.penaltySuspendedAt ?? new Date() : null,
        bannedAt: nextBanned ? existingUser.bannedAt ?? new Date() : null,
        paidMatchCredits: nextPaidMatchCredits,
        frozenPaidMatchCredits: nextFrozenPaidMatchCredits,
        forfeitedPaidMatchCredits: nextForfeitedPaidMatchCredits,
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

  app.post("/admin/users/:userId/match-access", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    const params = z.object({ userId: z.string().min(1) }).safeParse(request.params);
    const parsed = manageMatchAccessSchema.safeParse(request.body);

    if (!params.success) {
      return reply.status(400).send({
        error: "INVALID_MATCH_ACCESS_ACTION",
        details: params.error.flatten(),
      });
    }

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_MATCH_ACCESS_ACTION",
        details: parsed.error.flatten(),
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: params.data.userId },
      include: {
        profile: true,
        matchesAsA: { select: { id: true } },
        matchesAsB: { select: { id: true } },
      },
    });

    if (!existingUser) {
      return reply.status(404).send({ error: "USER_NOT_FOUND" });
    }

    let updateData: Record<string, unknown> = {};

    switch (parsed.data.action) {
      case "grant_pack":
        updateData = {
          paidMatchCredits: existingUser.paidMatchCredits + 8,
          lastPaidMatchPackageAt: new Date(),
        };
        break;
      case "freeze_paid":
        updateData = buildPauseAccountData(existingUser);
        break;
      case "restore_frozen":
        updateData = {
          ...buildRestorePausedAccountData(existingUser),
          suspendedAt: null,
          penaltySuspendedAt: null,
          bannedAt: null,
        };
        break;
      case "forfeit_paid":
        updateData = {
          paidMatchCredits: 0,
          frozenPaidMatchCredits: 0,
          forfeitedPaidMatchCredits:
            existingUser.forfeitedPaidMatchCredits + existingUser.paidMatchCredits + existingUser.frozenPaidMatchCredits,
        };
        break;
      case "ban_account":
        updateData = buildBanAccountData(existingUser);
        break;
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: updateData,
      include: {
        profile: true,
        matchesAsA: { select: { id: true } },
        matchesAsB: { select: { id: true } },
      },
    });

    return reply.send({
      ok: true,
      user: mapUserSummary(updatedUser),
    });
  });

  app.post("/admin/reports/:reportId/start-review", async (request, reply) => {
    if (!requireAdminAccess(request, reply)) {
      return;
    }

    const params = z.object({ reportId: z.string().min(1) }).safeParse(request.params);
    const parsed = startReviewSchema.safeParse(request.body);

    if (!params.success || !parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REPORT_REVIEW_START",
        details: {
          params: params.success ? undefined : params.error.flatten(),
          body: parsed.success ? undefined : parsed.error.flatten(),
        },
      });
    }

    const report = await prisma.report.findUnique({
      where: { id: params.data.reportId },
    });

    if (!report) {
      return reply.status(404).send({
        error: "REPORT_NOT_FOUND",
      });
    }

    if (report.status === "CONFIRMED" || report.status === "DISMISSED") {
      return reply.status(400).send({
        error: "REPORT_ALREADY_RESOLVED",
      });
    }

    const adminPhone = getAuthenticatedAdminPhone(request);
    const reviewerNote = parsed.data.reviewerNote?.trim() || report.reviewerNote || null;
    const updatedReport = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "IN_REVIEW",
        reviewStartedAt: report.reviewStartedAt ?? new Date(),
        reviewStartedByAdminPhone: report.reviewStartedByAdminPhone ?? adminPhone,
        reviewerNote,
      },
    });

    return reply.send({
      ok: true,
      report: updatedReport,
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

    if (report.status === "CONFIRMED" || report.status === "DISMISSED") {
      return reply.status(400).send({
        error: "REPORT_ALREADY_RESOLVED",
      });
    }

    const shouldConfirm = parsed.data.decision === "confirmed";
    const adminPhone = getAuthenticatedAdminPhone(request);
    const updatedReport = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: shouldConfirm ? "CONFIRMED" : "DISMISSED",
        reviewStartedAt: report.reviewStartedAt ?? new Date(),
        reviewStartedByAdminPhone: report.reviewStartedByAdminPhone ?? adminPhone,
        reviewerNote: parsed.data.reviewerNote?.trim() || null,
        reviewedAt: new Date(),
        reviewedByAdminPhone: adminPhone,
      },
    });

    if (shouldConfirm) {
      const reconciled = await reconcileUserPenaltyState(report.reportedUserId);
      const confirmedReason = report.reason.trim();
      const nextPenaltyPoints = reconciled?.account.penaltyPoints ?? report.reportedUser.penaltyPoints;
      void sendPushNotificationToUser(report.reportedUserId, {
        title: "Du hast einen Strafpunkt bekommen",
        body:
          nextPenaltyPoints >= 3
            ? `Die Meldung "${confirmedReason}" wurde bestaetigt. Dein Konto ist jetzt pausiert.`
            : `Die Meldung "${confirmedReason}" wurde bestaetigt. Dafuer wurde dir ein Strafpunkt gegeben.`,
        channelId: "fair-play",
        data: {
          type: "penalty",
          reason: "REPORT_CONFIRMED",
          reasonLabel: confirmedReason,
          penaltyPoints: nextPenaltyPoints,
          reportId: report.id,
        },
      });
    }

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
