import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export const INCLUDED_MATCH_LIMIT = 8;

type MatchAccessUser = {
  id: string;
  phoneNumber: string | null;
  paidMatchCredits: number;
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

export function canUserReceiveAnotherMatch(
  user: Pick<MatchAccessUser, "phoneNumber" | "paidMatchCredits">,
  totalMatchCount: number,
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

  if (!normalizedPhoneNumber) {
    return false;
  }

  return getRemainingIncludedMatches(totalMatchCount) > 0 || user.paidMatchCredits > 0;
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

export async function getOrCreatePhoneMatchCountForUser(
  user: { id: string; phoneNumber: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const normalizedPhoneNumber = normalizeTrackedPhoneNumber(user.phoneNumber);

  if (!normalizedPhoneNumber) {
    return 0;
  }

  const existing = await client.phoneMatchStats.findUnique({
    where: { phoneNumber: normalizedPhoneNumber },
    select: { totalMatchCount: true },
  });

  if (existing) {
    return existing.totalMatchCount;
  }

  const fallbackMatchCount = await countMatchesForUser(user.id, client);

  await client.phoneMatchStats.upsert({
    where: { phoneNumber: normalizedPhoneNumber },
    update: {
      totalMatchCount: {
        increment: 0,
      },
    },
    create: {
      phoneNumber: normalizedPhoneNumber,
      totalMatchCount: fallbackMatchCount,
    },
  });

  return fallbackMatchCount;
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

    if (totalMatchCount >= INCLUDED_MATCH_LIMIT) {
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
