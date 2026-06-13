import { buildPauseAccountData, mapAccountState } from "./account-state.js";
import { prisma } from "./prisma.js";

type ApplySystemPenaltyInput = {
  userId: string;
  reason: string;
  contextKey: string;
  note?: string;
};

export async function applySystemPenalty(input: ApplySystemPenaltyInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      isPremium: true,
      premiumActivatedAt: true,
      penaltyPoints: true,
      suspendedAt: true,
      bannedAt: true,
      paidMatchCredits: true,
      frozenPaidMatchCredits: true,
      forfeitedPaidMatchCredits: true,
      lastPaidMatchPackageAt: true,
    },
  });

  if (!user) {
    return {
      ok: false as const,
      reason: "USER_NOT_FOUND" as const,
    };
  }

  const existingEvent = await prisma.systemPenaltyEvent.findUnique({
    where: { contextKey: input.contextKey },
    select: { id: true },
  });

  if (existingEvent) {
    return {
      ok: true as const,
      applied: false,
      account: mapAccountState(user),
    };
  }

  const nextPenaltyPoints = Math.min(user.penaltyPoints + 1, 3);
  const pauseData = nextPenaltyPoints >= 3 ? buildPauseAccountData(user) : {};

  const updatedUser = await prisma.$transaction(async (transaction) => {
    await transaction.systemPenaltyEvent.create({
      data: {
        userId: input.userId,
        reason: input.reason.trim(),
        contextKey: input.contextKey.trim(),
        note: input.note?.trim() || undefined,
      },
    });

    return transaction.user.update({
      where: { id: input.userId },
      data: {
        penaltyPoints: nextPenaltyPoints,
        ...pauseData,
      },
      select: {
        id: true,
        isPremium: true,
        premiumActivatedAt: true,
        penaltyPoints: true,
        suspendedAt: true,
        bannedAt: true,
        paidMatchCredits: true,
        frozenPaidMatchCredits: true,
        forfeitedPaidMatchCredits: true,
        lastPaidMatchPackageAt: true,
      },
    });
  });

  return {
    ok: true as const,
    applied: true,
    account: mapAccountState(updatedUser),
  };
}
