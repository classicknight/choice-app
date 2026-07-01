import { buildPauseAccountData, mapAccountState } from "./account-state.js";
import { sendPushNotificationToUser } from "./push-notifications.js";
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

  const penaltyTitle = "Du hast einen Strafpunkt bekommen";
  const penaltyBody =
    input.reason === "PHASE_ONE_NOT_STARTED"
      ? updatedUser.penaltyPoints >= 3
        ? "Du hast den Chat nicht rechtzeitig eröffnet. Dein Konto ist jetzt pausiert."
        : "Du hast den Chat nicht rechtzeitig eröffnet. Dafür wurde dir ein Strafpunkt gegeben."
      : input.reason === "PHASE_TWO_NOT_PLAYED"
        ? updatedUser.penaltyPoints >= 3
          ? "Du hast Phase 2 nicht rechtzeitig gespielt. Dein Konto ist jetzt pausiert."
          : "Du hast Phase 2 nicht rechtzeitig gespielt. Dafür wurde dir ein Strafpunkt gegeben."
        : updatedUser.penaltyPoints >= 3
          ? "Dein Konto ist jetzt pausiert."
          : "Bitte prüfe dein Konto in Choice.";

  void sendPushNotificationToUser(input.userId, {
    title: penaltyTitle,
    body: penaltyBody,
    channelId: "fair-play",
    data: {
      type: "penalty",
      reason: input.reason,
      penaltyPoints: updatedUser.penaltyPoints,
    },
  });

  return {
    ok: true as const,
    applied: true,
    account: mapAccountState(updatedUser),
  };
}
