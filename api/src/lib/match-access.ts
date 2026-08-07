import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export const INCLUDED_MATCH_LIMIT = 8;

type MatchAccessUser = {
  id: string;
  phoneNumber: string | null;
  paidMatchCredits: number;
  isPremium: boolean;
  premiumExpiresAt?: Date | null;
};

function normalizeTrackedPhoneNumber(phoneNumber: string | null | undefined) {
  const normalized = phoneNumber?.trim();
  return normalized ? normalized : null;
}

export function getConsumedIncludedMatches(totalMatchCount: number) {
  return Math.min(Math.max(totalMatchCount, 0), INCLUDED_MATCH_LIMIT);
}

export function getRemainingIncludedMatches(totalMatchCount: number) {
  return Math.max(INCLUDED_MATCH_LIMIT - getConsumedIncludedMatches(totalMatchCount), 0);
}

export function hasActiveChoicePlus(
  user: Pick<MatchAccessUser, "isPremium" | "premiumExpiresAt">,
  now = new Date(),
) {
  return user.isPremium && (!user.premiumExpiresAt || user.premiumExpiresAt.getTime() > now.getTime());
}

export function canUserReceiveAnotherMatch(
  user: Pick<MatchAccessUser, "phoneNumber" | "paidMatchCredits" | "isPremium" | "premiumExpiresAt">,
  totalMatchCount: number,
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

  if (!normalizedPhoneNumber) {
    return false;
  }

  return hasActiveChoicePlus(user) || getRemainingIncludedMatches(totalMatchCount) > 0 || user.paidMatchCredits > 0;
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

async function countMatchesForUser(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.match.count({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
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

export async function getOrCreatePhoneMatchCountForUser(
  user: { id: string; phoneNumber: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

  if (!normalizedPhoneNumber) {
    return 0;
  }

  const [existing, currentMatchCount, releasedMatchCount] = await Promise.all([
    client.phoneMatchStats.findUnique({
      where: { phoneNumber: normalizedPhoneNumber },
      select: { totalMatchCount: true },
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
    if (reconciledMatchCount === existing.totalMatchCount) {
      return existing.totalMatchCount;
    }

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

    return getPhoneMatchCount(normalizedPhoneNumber, client);
  }

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
    },
    select: { totalMatchCount: true },
  });

  return persisted.totalMatchCount;
}

export async function createMatchAccessReservation(
  transaction: Prisma.TransactionClient,
  users: MatchAccessUser[],
) {
  const userMatchCounts = new Map<string, number>();

  for (const user of users) {
    const totalMatchCount = await getOrCreatePhoneMatchCountForUser(user, transaction);
    userMatchCounts.set(user.id, totalMatchCount);

    if (!canUserReceiveAnotherMatch(user, totalMatchCount)) {
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

    const totalMatchCount = userMatchCounts.get(user.id) ?? 0;

    await transaction.phoneMatchStats.upsert({
      where: { phoneNumber: normalizedPhoneNumber },
      update: {
        totalMatchCount: {
          increment: 1,
        },
      },
      create: {
        phoneNumber: normalizedPhoneNumber,
        totalMatchCount: 1,
      },
    });

    if (!hasActiveChoicePlus(user) && totalMatchCount >= INCLUDED_MATCH_LIMIT) {
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
