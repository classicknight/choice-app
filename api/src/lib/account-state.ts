import {
  getOrCreatePhoneMatchUsageForUser,
  getMonthlyFreeMatchState,
  getRemainingIncludedMatches,
  hasActiveChoicePlus,
  INCLUDED_MATCH_LIMIT,
  MONTHLY_FREE_MATCH_LIMIT,
} from "./match-access.js";

export type AccountStateShape = {
  id: string;
  isPremium: boolean;
  premiumActivatedAt: Date | null;
  premiumExpiresAt?: Date | null;
  premiumWillRenew?: boolean;
  premiumProductId?: string | null;
  premiumLastEventAt?: Date | null;
  penaltyPoints: number;
  suspendedAt: Date | null;
  penaltySuspendedAt: Date | null;
  bannedAt: Date | null;
  paidMatchCredits: number;
  frozenPaidMatchCredits: number;
  forfeitedPaidMatchCredits: number;
  lastPaidMatchPackageAt: Date | null;
};

export function isAccountPaused(user: Pick<AccountStateShape, "penaltyPoints" | "suspendedAt" | "penaltySuspendedAt" | "bannedAt">) {
  return user.penaltyPoints >= 3 || Boolean(user.suspendedAt) || Boolean(user.penaltySuspendedAt) || Boolean(user.bannedAt);
}

export function mapAccountState(user: AccountStateShape) {
  const choicePlusActive = hasActiveChoicePlus(user);

  return {
    userId: user.id,
    isPremium: user.isPremium,
    premiumActivatedAt: user.premiumActivatedAt,
    choicePlusActive,
    choicePlusProductId: user.premiumProductId ?? null,
    choicePlusExpiresAt: user.premiumExpiresAt ?? null,
    choicePlusWillRenew: choicePlusActive && Boolean(user.premiumWillRenew),
    penaltyPoints: user.penaltyPoints,
    suspendedAt: user.suspendedAt,
    penaltySuspendedAt: user.penaltySuspendedAt,
    bannedAt: user.bannedAt,
    accountPaused: isAccountPaused(user),
    accountBanned: Boolean(user.bannedAt),
    paidMatchCredits: user.paidMatchCredits,
    frozenPaidMatchCredits: user.frozenPaidMatchCredits,
    forfeitedPaidMatchCredits: user.forfeitedPaidMatchCredits,
    lastPaidMatchPackageAt: user.lastPaidMatchPackageAt,
    hasPaidMatchAccess: user.paidMatchCredits > 0,
  };
}

export async function buildAccountStatePayload(
  user: AccountStateShape & { id: string; phoneNumber?: string | null },
) {
  const matchUsage = await getOrCreatePhoneMatchUsageForUser({
    id: user.id,
    phoneNumber: user.phoneNumber ?? null,
  });
  const monthlyFreeMatchState = getMonthlyFreeMatchState(matchUsage);

  return {
    ...mapAccountState(user),
    totalMatchCount: matchUsage.totalMatchCount,
    meteredMatchCount: matchUsage.meteredMatchCount,
    includedMatchLimit: INCLUDED_MATCH_LIMIT,
    remainingIncludedMatches: getRemainingIncludedMatches(matchUsage.meteredMatchCount),
    monthlyFreeMatchLimit: MONTHLY_FREE_MATCH_LIMIT,
    monthlyFreeMatchCount: matchUsage.monthlyFreeMatchCount,
    monthlyFreeMatchesUsed: monthlyFreeMatchState.used,
    remainingMonthlyFreeMatches: monthlyFreeMatchState.remaining,
    monthlyFreeMatchesEligible: monthlyFreeMatchState.eligible,
    monthlyFreeMatchesEligibleFrom: monthlyFreeMatchState.eligibleFrom,
    nextMonthlyFreeMatchesAt: monthlyFreeMatchState.nextRefreshAt,
  };
}

export function buildPauseAccountData(user: Pick<AccountStateShape, "paidMatchCredits" | "frozenPaidMatchCredits" | "suspendedAt" | "bannedAt">) {
  if (user.bannedAt) {
    return {};
  }

  return {
    suspendedAt: user.suspendedAt ?? new Date(),
    paidMatchCredits: 0,
    frozenPaidMatchCredits: user.frozenPaidMatchCredits + user.paidMatchCredits,
  };
}

export function buildRestorePausedAccountData(user: Pick<AccountStateShape, "paidMatchCredits" | "frozenPaidMatchCredits">) {
  return {
    paidMatchCredits: user.paidMatchCredits + user.frozenPaidMatchCredits,
    frozenPaidMatchCredits: 0,
  };
}

export function buildPenaltyPauseAccountData(
  user: Pick<AccountStateShape, "paidMatchCredits" | "frozenPaidMatchCredits" | "penaltySuspendedAt" | "bannedAt">,
) {
  if (user.bannedAt) {
    return {};
  }

  return {
    penaltySuspendedAt: user.penaltySuspendedAt ?? new Date(),
    paidMatchCredits: 0,
    frozenPaidMatchCredits: user.frozenPaidMatchCredits + user.paidMatchCredits,
  };
}

export function buildRestorePenaltyPauseAccountData(
  user: Pick<AccountStateShape, "paidMatchCredits" | "frozenPaidMatchCredits" | "penaltySuspendedAt">,
) {
  return {
    penaltySuspendedAt: null,
    paidMatchCredits: user.paidMatchCredits + user.frozenPaidMatchCredits,
    frozenPaidMatchCredits: 0,
  };
}

export function buildBanAccountData(
  user: Pick<AccountStateShape, "paidMatchCredits" | "frozenPaidMatchCredits" | "forfeitedPaidMatchCredits" | "bannedAt" | "suspendedAt">,
) {
  return {
    bannedAt: user.bannedAt ?? new Date(),
    suspendedAt: user.suspendedAt ?? new Date(),
    penaltySuspendedAt: null,
    paidMatchCredits: 0,
    frozenPaidMatchCredits: user.frozenPaidMatchCredits + user.paidMatchCredits,
    forfeitedPaidMatchCredits: user.forfeitedPaidMatchCredits,
  };
}
