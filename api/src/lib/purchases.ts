import type { Prisma } from "@prisma/client";
import { PurchasePlatform, PurchaseStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

export const MATCH_PACK_8_PRODUCT_ID = "match_pack_8";
export const MATCH_PACK_8_CREDIT_AMOUNT = 8;
export const CHOICE_PLUS_MONTHLY_PRODUCT_ID = "choice_plus_monthly";
export const CHOICE_PLUS_ENTITLEMENT_ID = "choice_plus";

const choicePlusActivationEvents = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "SUBSCRIPTION_EXTENDED",
  "REFUND_REVERSED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
const choicePlusAccessEvents = new Set([
  ...choicePlusActivationEvents,
  "CANCELLATION",
  "EXPIRATION",
]);

type ChoicePlusEventInput = {
  userId: string;
  productId: string;
  eventType: string;
  platform: PurchasePlatform;
  environment?: string | null;
  purchasedAt?: Date | null;
  expiresAt?: Date | null;
  eventTimestamp?: Date | null;
  revenueCatEventId?: string | null;
  revenueCatAppUserId?: string | null;
  revenueCatOfferingId?: string | null;
  rawPayload: Prisma.InputJsonValue;
};

function normalizeEventType(value: string) {
  return value.trim().toUpperCase();
}

function readRevenueCatEvent(rawPayload: Prisma.JsonValue | null | undefined) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return null;
  }

  const root = rawPayload as Record<string, unknown>;
  const event = root.event;

  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return null;
  }

  return event as Record<string, unknown>;
}

function readEventTimestampMs(rawPayload: Prisma.JsonValue | null | undefined) {
  const value = readRevenueCatEvent(rawPayload)?.event_timestamp_ms;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getPurchaseCatalog() {
  return [
    {
      id: MATCH_PACK_8_PRODUCT_ID,
      title: "8 weitere Matches",
      description: "Schaltet 8 weitere Matches frei, sobald deine ersten 8 Matches aufgebraucht sind.",
      creditAmount: MATCH_PACK_8_CREDIT_AMOUNT,
      type: "consumable" as const,
      displayPrice: "3,99 €",
    },
    {
      id: CHOICE_PLUS_MONTHLY_PRODUCT_ID,
      entitlementId: CHOICE_PLUS_ENTITLEMENT_ID,
      title: "Choice Plus",
      description: "Bis zu ein bewusst ausgewähltes Match pro Tag, ohne Match-Guthaben.",
      type: "subscription" as const,
      duration: "P1M" as const,
      displayPrice: "9,99 € / Monat",
    },
  ];
}

export function parseRevenueCatPlatform(value?: string | null) {
  const normalized = value?.trim().toUpperCase();

  if (normalized === "APP_STORE" || normalized === "IOS") {
    return PurchasePlatform.APPLE;
  }

  if (normalized === "PLAY_STORE" || normalized === "ANDROID") {
    return PurchasePlatform.GOOGLE;
  }

  return PurchasePlatform.UNKNOWN;
}

export function shouldGrantCreditsForRevenueCatEvent(eventType: string) {
  return ["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"].includes(normalizeEventType(eventType));
}

export function isChoicePlusEvent(productId: string, entitlementIds: string[] = []) {
  return productId === CHOICE_PLUS_MONTHLY_PRODUCT_ID || entitlementIds.includes(CHOICE_PLUS_ENTITLEMENT_ID);
}

export async function recordMatchPackPurchase(params: {
  userId: string;
  productId: string;
  platform: PurchasePlatform;
  environment?: string | null;
  purchasedAt?: Date | null;
  revenueCatEventId?: string | null;
  revenueCatAppUserId?: string | null;
  revenueCatOfferingId?: string | null;
  storeTransactionId?: string | null;
  shouldGrantCredits: boolean;
  rawPayload: Prisma.InputJsonValue;
}) {
  const existingPurchase = params.revenueCatEventId
    ? await prisma.purchase.findUnique({
        where: {
          revenueCatEventId: params.revenueCatEventId,
        },
      })
    : params.storeTransactionId
      ? await prisma.purchase.findUnique({
          where: {
            storeTransactionId: params.storeTransactionId,
          },
        })
      : null;

  if (existingPurchase) {
    return {
      purchase: existingPurchase,
      grantedCredits: false,
      alreadyProcessed: true,
    };
  }

  const creditsGranted = params.productId === MATCH_PACK_8_PRODUCT_ID && params.shouldGrantCredits
    ? MATCH_PACK_8_CREDIT_AMOUNT
    : 0;

  const result = await prisma.$transaction(async (transaction) => {
    const purchase = await transaction.purchase.create({
      data: {
        userId: params.userId,
        productId: params.productId,
        platform: params.platform,
        status: creditsGranted > 0 ? PurchaseStatus.GRANTED : PurchaseStatus.IGNORED,
        creditsGranted,
        grantedAt: creditsGranted > 0 ? new Date() : null,
        purchasedAt: params.purchasedAt ?? null,
        environment: params.environment ?? null,
        revenueCatEventId: params.revenueCatEventId ?? null,
        revenueCatAppUserId: params.revenueCatAppUserId ?? null,
        revenueCatOfferingId: params.revenueCatOfferingId ?? null,
        storeTransactionId: params.storeTransactionId ?? null,
        rawPayload: params.rawPayload,
      },
    });

    if (creditsGranted > 0) {
      await transaction.user.update({
        where: {
          id: params.userId,
        },
        data: {
          paidMatchCredits: {
            increment: creditsGranted,
          },
          lastPaidMatchPackageAt: new Date(),
        },
      });
    }

    return purchase;
  });

  return {
    purchase: result,
    grantedCredits: creditsGranted > 0,
    alreadyProcessed: false,
  };
}

export async function recordChoicePlusEvent(params: ChoicePlusEventInput) {
  const existingPurchase = params.revenueCatEventId
    ? await prisma.purchase.findUnique({
        where: { revenueCatEventId: params.revenueCatEventId },
      })
    : null;

  if (existingPurchase) {
    const account = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { isPremium: true },
    });

    return {
      purchase: existingPurchase,
      subscriptionActive: account?.isPremium ?? false,
      eventApplied: false,
      alreadyProcessed: true,
    };
  }

  const eventType = normalizeEventType(params.eventType);
  const now = new Date();
  const eventTimestampMs = params.eventTimestamp?.getTime() ?? null;

  return prisma.$transaction(async (transaction) => {
    const [user, latestAcceptedEvent] = await Promise.all([
      transaction.user.findUnique({
        where: { id: params.userId },
        select: {
          isPremium: true,
          premiumActivatedAt: true,
          premiumExpiresAt: true,
          premiumWillRenew: true,
          premiumProductId: true,
          premiumLastEventAt: true,
        },
      }),
      transaction.purchase.findFirst({
        where: {
          userId: params.userId,
          productId: CHOICE_PLUS_MONTHLY_PRODUCT_ID,
          status: { in: [PurchaseStatus.GRANTED, PurchaseStatus.REVOKED] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!user) {
      throw new Error("PURCHASE_USER_NOT_FOUND");
    }

    const latestEventTimestampMs = user.premiumLastEventAt?.getTime()
      ?? readEventTimestampMs(latestAcceptedEvent?.rawPayload);
    const staleEvent = eventTimestampMs !== null
      && latestEventTimestampMs !== null
      && eventTimestampMs < latestEventTimestampMs;
    const canAffectAccess = choicePlusAccessEvents.has(eventType);
    const expiresInFuture = params.expiresAt ? params.expiresAt.getTime() > now.getTime() : true;
    const nextSubscriptionActive = eventType === "EXPIRATION"
      ? false
      : choicePlusActivationEvents.has(eventType)
        ? expiresInFuture
        : eventType === "CANCELLATION"
          ? Boolean(params.expiresAt ? expiresInFuture : user.isPremium)
          : user.isPremium;
    const nextWillRenew = eventType === "CANCELLATION" || eventType === "EXPIRATION"
      ? false
      : eventType === "SUBSCRIPTION_EXTENDED" || eventType === "REFUND_REVERSED"
        ? user.premiumWillRenew
        : choicePlusActivationEvents.has(eventType)
          ? true
          : user.premiumWillRenew;
    const purchaseStatus = staleEvent || !canAffectAccess
      ? staleEvent
        ? PurchaseStatus.IGNORED
        : PurchaseStatus.RECEIVED
      : nextSubscriptionActive
        ? PurchaseStatus.GRANTED
        : PurchaseStatus.REVOKED;

    const purchase = await transaction.purchase.create({
      data: {
        userId: params.userId,
        productId: CHOICE_PLUS_MONTHLY_PRODUCT_ID,
        platform: params.platform,
        status: purchaseStatus,
        creditsGranted: 0,
        grantedAt: purchaseStatus === PurchaseStatus.GRANTED ? now : null,
        purchasedAt: params.purchasedAt ?? null,
        environment: params.environment ?? null,
        revenueCatEventId: params.revenueCatEventId ?? null,
        revenueCatAppUserId: params.revenueCatAppUserId ?? null,
        revenueCatOfferingId: params.revenueCatOfferingId ?? null,
        rawPayload: params.rawPayload,
      },
    });

    if (!staleEvent && canAffectAccess) {
      await transaction.user.update({
        where: { id: params.userId },
        data: {
          isPremium: nextSubscriptionActive,
          premiumActivatedAt: nextSubscriptionActive
            ? user.premiumActivatedAt ?? params.purchasedAt ?? now
            : user.premiumActivatedAt,
          premiumExpiresAt: params.expiresAt ?? user.premiumExpiresAt,
          premiumWillRenew: nextWillRenew,
          premiumProductId: params.productId,
          premiumLastEventAt: params.eventTimestamp ?? now,
        },
      });
    }

    return {
      purchase,
      subscriptionActive: !staleEvent && canAffectAccess ? nextSubscriptionActive : user.isPremium,
      eventApplied: !staleEvent && canAffectAccess,
      alreadyProcessed: false,
    };
  });
}
