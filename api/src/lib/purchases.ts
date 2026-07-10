import type { Prisma } from "@prisma/client";
import { PurchasePlatform, PurchaseStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

export const MATCH_PACK_8_PRODUCT_ID = "match_pack_8";
export const MATCH_PACK_8_CREDIT_AMOUNT = 8;

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
  return ["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"].includes(eventType.trim().toUpperCase());
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
