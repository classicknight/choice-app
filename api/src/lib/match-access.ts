import type { Prisma } from "@prisma/client";
import { isAppReviewAccountEmail } from "./app-review.js";
import { prisma } from "./prisma.js";
import { isSyntheticMatchingAccountEmail } from "./synthetic-accounts.js";

export const INCLUDED_MATCH_LIMIT = 8;
export const MONTHLY_FREE_MATCH_LIMIT = 2;
export const MONTHLY_FREE_MATCH_TIME_ZONE = "Europe/Berlin";

type MatchAccessUser = {
  id: string;
  phoneNumber: string | null;
  paidMatchCredits: number;
  isPremium: boolean;
  premiumExpiresAt?: Date | null;
};

export type PhoneMatchUsage = {
  totalMatchCount: number;
  choicePlusMatchCount: number;
  meteredMatchCount: number;
  monthlyFreeMatchCount: number;
  monthlyFreeMatchEligibleFrom: string | null;
  monthlyFreeMatchPeriod: string | null;
  monthlyFreeMatchUsed: number;
};

export type MonthlyFreeMatchState = {
  currentPeriod: string;
  eligible: boolean;
  eligibleFrom: string | null;
  used: number;
  remaining: number;
  nextRefreshAt: Date | null;
};

export type MatchAccessSource = "choice-plus" | "starter" | "monthly-free" | "paid";

function normalizeTrackedPhoneNumber(phoneNumber: string | null | undefined) {
  const normalized = phoneNumber?.trim();
  return normalized ? normalized : null;
}

export function getConsumedIncludedMatches(meteredMatchCount: number) {
  return Math.min(Math.max(meteredMatchCount, 0), INCLUDED_MATCH_LIMIT);
}

export function getRemainingIncludedMatches(meteredMatchCount: number) {
  return Math.max(INCLUDED_MATCH_LIMIT - getConsumedIncludedMatches(meteredMatchCount), 0);
}

export function getMeteredMatchCount(totalMatchCount: number, choicePlusMatchCount: number) {
  const normalizedTotal = Math.max(0, Math.trunc(totalMatchCount));
  const normalizedChoicePlus = Math.min(
    normalizedTotal,
    Math.max(0, Math.trunc(choicePlusMatchCount)),
  );

  return normalizedTotal - normalizedChoicePlus;
}

export function getMonthlyFreeMatchPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTHLY_FREE_MATCH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("MONTHLY_FREE_MATCH_PERIOD_UNAVAILABLE");
  }

  return `${year}-${month}`;
}

export function getNextMonthlyFreeMatchPeriod(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);

  if (!match) {
    throw new Error("INVALID_MONTHLY_FREE_MATCH_PERIOD");
  }

  const nextMonth = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
  return `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyFreeMatchPeriodStart(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);

  if (!match) {
    return null;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export function getMonthlyFreeMatchState(
  usage: Pick<
    PhoneMatchUsage,
    "monthlyFreeMatchEligibleFrom" | "monthlyFreeMatchPeriod" | "monthlyFreeMatchUsed"
  >,
  now = new Date(),
): MonthlyFreeMatchState {
  const currentPeriod = getMonthlyFreeMatchPeriod(now);
  const eligibleFrom = usage.monthlyFreeMatchEligibleFrom;
  const eligible = Boolean(eligibleFrom && eligibleFrom <= currentPeriod);
  const used = eligible && usage.monthlyFreeMatchPeriod === currentPeriod
    ? Math.min(MONTHLY_FREE_MATCH_LIMIT, Math.max(0, Math.trunc(usage.monthlyFreeMatchUsed)))
    : 0;
  const nextPeriod = eligible ? getNextMonthlyFreeMatchPeriod(currentPeriod) : eligibleFrom;

  return {
    currentPeriod,
    eligible,
    eligibleFrom,
    used,
    remaining: eligible ? Math.max(MONTHLY_FREE_MATCH_LIMIT - used, 0) : 0,
    nextRefreshAt: nextPeriod ? getMonthlyFreeMatchPeriodStart(nextPeriod) : null,
  };
}

export function hasActiveChoicePlus(
  user: Pick<MatchAccessUser, "isPremium" | "premiumExpiresAt">,
  now = new Date(),
) {
  return user.isPremium && (!user.premiumExpiresAt || user.premiumExpiresAt.getTime() > now.getTime());
}

export function getNextMatchAccessSource(
  user: Pick<MatchAccessUser, "phoneNumber" | "paidMatchCredits" | "isPremium" | "premiumExpiresAt">,
  usage: PhoneMatchUsage,
  now = new Date(),
): MatchAccessSource | null {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

  if (!normalizedPhoneNumber) {
    return null;
  }

  if (hasActiveChoicePlus(user, now)) {
    return "choice-plus";
  }

  if (getRemainingIncludedMatches(usage.meteredMatchCount) > 0) {
    return "starter";
  }

  if (getMonthlyFreeMatchState(usage, now).remaining > 0) {
    return "monthly-free";
  }

  return user.paidMatchCredits > 0 ? "paid" : null;
}

export function canUserReceiveAnotherMatch(
  user: Pick<MatchAccessUser, "phoneNumber" | "paidMatchCredits" | "isPremium" | "premiumExpiresAt">,
  usage: PhoneMatchUsage,
  now = new Date(),
) {
  return getNextMatchAccessSource(user, usage, now) !== null;
}

export async function getPhoneMatchStatsMap(
  phoneNumbers: Array<string | null | undefined>,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const normalizedPhoneNumbers = Array.from(
    new Set(phoneNumbers.map((entry) => normalizeTrackedPhoneNumber(entry)).filter((entry): entry is string => Boolean(entry))),
  );

  if (!normalizedPhoneNumbers.length) {
    return new Map<string, { phoneNumber: string; totalMatchCount: number }>();
  }

  const stats = await client.phoneMatchStats.findMany({
    where: {
      phoneNumber: {
        in: normalizedPhoneNumbers,
      },
    },
    select: {
      phoneNumber: true,
      totalMatchCount: true,
      choicePlusMatchCount: true,
    },
  });

  return new Map(stats.map((entry) => [entry.phoneNumber, entry]));
}

export async function getPhoneMatchCount(
  phoneNumber: string | null | undefined,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    return 0;
  }

  const existing = await client.phoneMatchStats.findUnique({
    where: { phoneNumber: normalizedPhoneNumber },
    select: { totalMatchCount: true },
  });

  return existing?.totalMatchCount ?? 0;
}

export async function getPhoneMatchUsage(
  phoneNumber: string | null | undefined,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    return {
      totalMatchCount: 0,
      choicePlusMatchCount: 0,
      meteredMatchCount: 0,
      monthlyFreeMatchCount: 0,
      monthlyFreeMatchEligibleFrom: null,
      monthlyFreeMatchPeriod: null,
      monthlyFreeMatchUsed: 0,
    };
  }

  const existing = await client.phoneMatchStats.findUnique({
    where: { phoneNumber: normalizedPhoneNumber },
    select: {
      totalMatchCount: true,
      choicePlusMatchCount: true,
      monthlyFreeMatchCount: true,
      monthlyFreeMatchEligibleFrom: true,
      monthlyFreeMatchPeriod: true,
      monthlyFreeMatchUsed: true,
    },
  });
  const totalMatchCount = existing?.totalMatchCount ?? 0;
  const choicePlusMatchCount = existing?.choicePlusMatchCount ?? 0;

  return {
    totalMatchCount,
    choicePlusMatchCount,
    meteredMatchCount: getMeteredMatchCount(totalMatchCount, choicePlusMatchCount),
    monthlyFreeMatchCount: existing?.monthlyFreeMatchCount ?? 0,
    monthlyFreeMatchEligibleFrom: existing?.monthlyFreeMatchEligibleFrom ?? null,
    monthlyFreeMatchPeriod: existing?.monthlyFreeMatchPeriod ?? null,
    monthlyFreeMatchUsed: existing?.monthlyFreeMatchUsed ?? 0,
  };
}

type MatchParticipantPair = {
  userAId: string;
  userBId: string;
  userA: { email: string | null };
  userB: { email: string | null };
};

export function shouldCountMatchForUser(userId: string, match: MatchParticipantPair) {
  const partnerEmail = match.userAId === userId
    ? match.userB.email
    : match.userBId === userId
      ? match.userA.email
      : null;

  return (match.userAId === userId || match.userBId === userId)
    && !isSyntheticMatchingAccountEmail(partnerEmail)
    && !isAppReviewAccountEmail(partnerEmail);
}

async function countMatchesForUser(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const matches = await client.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: {
      userAId: true,
      userBId: true,
      userA: { select: { email: true } },
      userB: { select: { email: true } },
    },
  });

  return matches.filter((match) => shouldCountMatchForUser(userId, match)).length;
}

async function countReleasedMatchesForUser(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.notificationDispatch.count({
    where: {
      userId,
      kind: "match-release",
    },
  });
}

export function getReconciledTotalMatchCount(...counts: number[]) {
  return Math.max(0, ...counts.map((count) => Math.max(0, Math.trunc(count))));
}

export async function getOrCreatePhoneMatchUsageForUser(
  user: { id: string; phoneNumber: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma,
  now = new Date(),
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

  if (!normalizedPhoneNumber) {
    return {
      totalMatchCount: 0,
      choicePlusMatchCount: 0,
      meteredMatchCount: 0,
      monthlyFreeMatchCount: 0,
      monthlyFreeMatchEligibleFrom: null,
      monthlyFreeMatchPeriod: null,
      monthlyFreeMatchUsed: 0,
    };
  }

  const [existing, currentMatchCount, releasedMatchCount] = await Promise.all([
    client.phoneMatchStats.findUnique({
      where: { phoneNumber: normalizedPhoneNumber },
      select: {
        totalMatchCount: true,
        choicePlusMatchCount: true,
        monthlyFreeMatchCount: true,
        monthlyFreeMatchEligibleFrom: true,
        monthlyFreeMatchPeriod: true,
        monthlyFreeMatchUsed: true,
      },
    }),
    countMatchesForUser(user.id, client),
    countReleasedMatchesForUser(user.id, client),
  ]);

  const reconciledMatchCount = getReconciledTotalMatchCount(
    existing?.totalMatchCount ?? 0,
    currentMatchCount,
    releasedMatchCount,
  );

  if (existing) {
    const meteredMatchCount = getMeteredMatchCount(reconciledMatchCount, existing.choicePlusMatchCount);

    // Only move the durable counter forward so concurrent reservations cannot be lost.
    await client.phoneMatchStats.updateMany({
      where: {
        phoneNumber: normalizedPhoneNumber,
        totalMatchCount: { lt: reconciledMatchCount },
      },
      data: {
        totalMatchCount: reconciledMatchCount,
      },
    });

    if (meteredMatchCount >= INCLUDED_MATCH_LIMIT && !existing.monthlyFreeMatchEligibleFrom) {
      // Existing accounts that already passed the starter allowance join the current month immediately.
      await client.phoneMatchStats.updateMany({
        where: {
          phoneNumber: normalizedPhoneNumber,
          monthlyFreeMatchEligibleFrom: null,
        },
        data: {
          monthlyFreeMatchEligibleFrom: getMonthlyFreeMatchPeriod(now),
        },
      });
    }

    return getPhoneMatchUsage(normalizedPhoneNumber, client);
  }

  const meteredMatchCount = getMeteredMatchCount(reconciledMatchCount, 0);

  const persisted = await client.phoneMatchStats.upsert({
    where: { phoneNumber: normalizedPhoneNumber },
    update: {
      totalMatchCount: {
        increment: 0,
      },
    },
    create: {
      phoneNumber: normalizedPhoneNumber,
      totalMatchCount: reconciledMatchCount,
      choicePlusMatchCount: 0,
      monthlyFreeMatchEligibleFrom:
        meteredMatchCount >= INCLUDED_MATCH_LIMIT ? getMonthlyFreeMatchPeriod(now) : null,
    },
    select: {
      totalMatchCount: true,
      choicePlusMatchCount: true,
      monthlyFreeMatchCount: true,
      monthlyFreeMatchEligibleFrom: true,
      monthlyFreeMatchPeriod: true,
      monthlyFreeMatchUsed: true,
    },
  });

  return {
    totalMatchCount: persisted.totalMatchCount,
    choicePlusMatchCount: persisted.choicePlusMatchCount,
    meteredMatchCount: getMeteredMatchCount(persisted.totalMatchCount, persisted.choicePlusMatchCount),
    monthlyFreeMatchCount: persisted.monthlyFreeMatchCount,
    monthlyFreeMatchEligibleFrom: persisted.monthlyFreeMatchEligibleFrom,
    monthlyFreeMatchPeriod: persisted.monthlyFreeMatchPeriod,
    monthlyFreeMatchUsed: persisted.monthlyFreeMatchUsed,
  };
}

export async function getOrCreatePhoneMatchCountForUser(
  user: { id: string; phoneNumber: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const usage = await getOrCreatePhoneMatchUsageForUser(user, client);
  return usage.totalMatchCount;
}

export async function createMatchAccessReservation(
  transaction: Prisma.TransactionClient,
  users: MatchAccessUser[],
  now = new Date(),
) {
  const userMatchUsages = new Map<string, Awaited<ReturnType<typeof getOrCreatePhoneMatchUsageForUser>>>();

  for (const user of users) {
    const usage = await getOrCreatePhoneMatchUsageForUser(user, transaction, now);
    userMatchUsages.set(user.id, usage);

    if (!canUserReceiveAnotherMatch(user, usage, now)) {
      return {
        ok: false as const,
        blockedUserId: user.id,
      };
    }
  }

  for (const user of users) {
    const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

    if (!normalizedPhoneNumber) {
      continue;
    }

    const usage = userMatchUsages.get(user.id) ?? {
      totalMatchCount: 0,
      choicePlusMatchCount: 0,
      meteredMatchCount: 0,
      monthlyFreeMatchCount: 0,
      monthlyFreeMatchEligibleFrom: null,
      monthlyFreeMatchPeriod: null,
      monthlyFreeMatchUsed: 0,
    };
    const accessSource = getNextMatchAccessSource(user, usage, now);
    const choicePlusActive = accessSource === "choice-plus";
    const consumesIncludedMatch = accessSource === "starter";
    const monthlyFreeMatchState = getMonthlyFreeMatchState(usage, now);
    const consumesMonthlyFreeMatch = accessSource === "monthly-free";
    const consumesPaidMatch = accessSource === "paid";
    const monthlyFreeMatchEligibleFrom = consumesIncludedMatch
      && usage.meteredMatchCount + 1 >= INCLUDED_MATCH_LIMIT
      && !usage.monthlyFreeMatchEligibleFrom
        ? getNextMonthlyFreeMatchPeriod(getMonthlyFreeMatchPeriod(now))
        : null;

    await transaction.phoneMatchStats.upsert({
      where: { phoneNumber: normalizedPhoneNumber },
      update: {
        totalMatchCount: {
          increment: 1,
        },
        ...(choicePlusActive
          ? {
              choicePlusMatchCount: {
                increment: 1,
              },
            }
          : {}),
        ...(monthlyFreeMatchEligibleFrom ? { monthlyFreeMatchEligibleFrom } : {}),
        ...(consumesMonthlyFreeMatch
          ? {
              monthlyFreeMatchCount: {
                increment: 1,
              },
              monthlyFreeMatchPeriod: monthlyFreeMatchState.currentPeriod,
              monthlyFreeMatchUsed: monthlyFreeMatchState.used + 1,
            }
          : {}),
      },
      create: {
        phoneNumber: normalizedPhoneNumber,
        totalMatchCount: 1,
        choicePlusMatchCount: choicePlusActive ? 1 : 0,
        monthlyFreeMatchCount: consumesMonthlyFreeMatch ? 1 : 0,
        monthlyFreeMatchEligibleFrom,
        monthlyFreeMatchPeriod: consumesMonthlyFreeMatch ? monthlyFreeMatchState.currentPeriod : null,
        monthlyFreeMatchUsed: consumesMonthlyFreeMatch ? monthlyFreeMatchState.used + 1 : 0,
      },
    });

    if (consumesPaidMatch) {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          paidMatchCredits: {
            decrement: 1,
          },
        },
      });
    }
  }

  return {
    ok: true as const,
  };
}
