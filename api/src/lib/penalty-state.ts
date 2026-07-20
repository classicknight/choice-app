import {
  buildAccountStatePayload,
  buildPenaltyPauseAccountData,
  buildRestorePenaltyPauseAccountData,
} from "./account-state.js";
import { prisma } from "./prisma.js";

const PENALTY_RECOVERY_WINDOW_DAYS = 3;
const PENALTY_RECOVERY_WINDOW_MS = PENALTY_RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function normalizeReportReasonKey(reason: string) {
  return reason.trim().toLocaleLowerCase("de-DE");
}

function getSystemReasonLabel(reason: string, note?: string | null) {
  if (reason === "PHASE_ONE_NOT_STARTED") {
    return "Du hast nicht geschrieben, obwohl Choice dich zum Starten ausgewählt hat.";
  }

  if (reason === "PHASE_TWO_NOT_PLAYED") {
    return "Du hast Phase 2 nicht rechtzeitig gespielt.";
  }

  return note?.trim() || "Systemseitiger Strafpunkt";
}

type PenaltyUserRecord = Awaited<ReturnType<typeof loadPenaltyUserRecord>>;

async function loadPenaltyUserRecord(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      systemPenaltyEvents: {
        orderBy: { createdAt: "desc" },
      },
      reportsReceived: {
        where: { status: "CONFIRMED" },
        orderBy: { reviewedAt: "desc" },
      },
    },
  });
}

export async function reconcileUserPenaltyState(userId: string, now = new Date()) {
  const user = await loadPenaltyUserRecord(userId);

  if (!user) {
    return null;
  }

  const latestByReason = new Map<
    string,
    {
      createdAt: Date;
      reasonLabel: string;
    }
  >();

  for (const event of user.systemPenaltyEvents) {
    const key = `system:${event.reason.trim()}`;
    const previous = latestByReason.get(key);

    if (!previous || event.createdAt.getTime() > previous.createdAt.getTime()) {
      latestByReason.set(key, {
        createdAt: event.createdAt,
        reasonLabel: getSystemReasonLabel(event.reason, event.note),
      });
    }
  }

  for (const report of user.reportsReceived) {
    const timestamp = report.reviewedAt ?? report.updatedAt;
    const key = `report:${normalizeReportReasonKey(report.reason)}`;
    const previous = latestByReason.get(key);

    if (!previous || timestamp.getTime() > previous.createdAt.getTime()) {
      latestByReason.set(key, {
        createdAt: timestamp,
        reasonLabel: report.reason.trim(),
      });
    }
  }

  const activePenaltyEntries = [...latestByReason.values()].filter(
    (entry) => now.getTime() - entry.createdAt.getTime() < PENALTY_RECOVERY_WINDOW_MS,
  );
  const nextPenaltyPoints = Math.min(activePenaltyEntries.length, 3);

  const updateData: Record<string, Date | number | null> = {};

  if (user.penaltyPoints !== nextPenaltyPoints) {
    updateData.penaltyPoints = nextPenaltyPoints;
  }

  if (nextPenaltyPoints >= 3 && !user.penaltySuspendedAt && !user.bannedAt) {
    Object.assign(updateData, buildPenaltyPauseAccountData(user));
  }

  if (nextPenaltyPoints < 3 && user.penaltySuspendedAt && !user.bannedAt) {
    Object.assign(updateData, buildRestorePenaltyPauseAccountData(user));
  }

  if (!Object.keys(updateData).length) {
    return {
      account: await buildAccountStatePayload(user),
      activePenaltyPoints: nextPenaltyPoints,
      recoveryWindowDays: PENALTY_RECOVERY_WINDOW_DAYS,
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      phoneNumber: true,
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

  return {
    account: await buildAccountStatePayload(updatedUser),
    activePenaltyPoints: nextPenaltyPoints,
    recoveryWindowDays: PENALTY_RECOVERY_WINDOW_DAYS,
  };
}

export async function reconcileAllPenaltyStates(now = new Date()) {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { penaltyPoints: { gt: 0 } },
        { penaltySuspendedAt: { not: null } },
      ],
    },
    select: { id: true },
  });

  let processedUsers = 0;
  let failedUsers = 0;

  for (const user of candidates) {
    try {
      await reconcileUserPenaltyState(user.id, now);
      processedUsers += 1;
    } catch {
      failedUsers += 1;
    }
  }

  return {
    processedUsers,
    failedUsers,
  };
}

export { PENALTY_RECOVERY_WINDOW_DAYS };
