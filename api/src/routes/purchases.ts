import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getPurchaseCatalog,
  isChoicePlusEvent,
  parseRevenueCatPlatform,
  recordChoicePlusEvent,
  recordMatchPackPurchase,
  shouldGrantCreditsForRevenueCatEvent,
} from "../lib/purchases.js";

const revenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string().optional(),
    type: z.string().min(1),
    app_user_id: z.string().min(1),
    product_id: z.string().min(1),
    store: z.string().optional(),
    environment: z.string().optional(),
    purchased_at_ms: z.coerce.number().optional(),
    event_timestamp_ms: z.coerce.number().optional(),
    expiration_at_ms: z.coerce.number().nullable().optional(),
    original_transaction_id: z.string().optional(),
    transaction_id: z.string().optional(),
    presented_offering_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).optional(),
  }).passthrough(),
}).passthrough();

export const purchaseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/purchases/catalog", async (_request, reply) => {
    return reply.send({
      ok: true,
      products: getPurchaseCatalog(),
    });
  });

  app.post("/purchases/revenuecat/webhook", async (request, reply) => {
    const expectedAuth = app.config.REVENUECAT_WEBHOOK_AUTH?.trim();
    const authHeader = request.headers.authorization?.trim();

    if (!expectedAuth && app.config.NODE_ENV === "production") {
      return reply.status(503).send({
        error: "REVENUECAT_WEBHOOK_NOT_CONFIGURED",
      });
    }

    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return reply.status(401).send({
        error: "UNAUTHORIZED_WEBHOOK",
      });
    }

    const parsed = revenueCatWebhookSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REVENUECAT_WEBHOOK",
      });
    }

    const event = parsed.data.event;
    const purchasedAt = typeof event.purchased_at_ms === "number"
      ? new Date(event.purchased_at_ms)
      : typeof event.event_timestamp_ms === "number"
        ? new Date(event.event_timestamp_ms)
        : null;

    if (isChoicePlusEvent(event.product_id, event.entitlement_ids)) {
      const result = await recordChoicePlusEvent({
        userId: event.app_user_id,
        productId: event.product_id,
        eventType: event.type,
        platform: parseRevenueCatPlatform(event.store),
        environment: event.environment ?? null,
        purchasedAt,
        expiresAt: typeof event.expiration_at_ms === "number" ? new Date(event.expiration_at_ms) : null,
        eventTimestamp: typeof event.event_timestamp_ms === "number" ? new Date(event.event_timestamp_ms) : null,
        revenueCatEventId: event.id ?? null,
        revenueCatAppUserId: event.app_user_id,
        revenueCatOfferingId: event.presented_offering_id ?? null,
        rawPayload: parsed.data as Prisma.InputJsonValue,
      });

      return reply.send({
        ok: true,
        alreadyProcessed: result.alreadyProcessed,
        eventApplied: result.eventApplied,
        subscriptionActive: result.subscriptionActive,
        grantedCredits: false,
        purchaseId: result.purchase.id,
      });
    }

    const shouldGrantCredits = shouldGrantCreditsForRevenueCatEvent(event.type);
    const result = await recordMatchPackPurchase({
      userId: event.app_user_id,
      productId: event.product_id,
      platform: parseRevenueCatPlatform(event.store),
      environment: event.environment ?? null,
      purchasedAt,
      revenueCatEventId: event.id ?? null,
      revenueCatAppUserId: event.app_user_id,
      revenueCatOfferingId: event.presented_offering_id ?? null,
      storeTransactionId: shouldGrantCredits ? event.transaction_id ?? event.original_transaction_id ?? null : null,
      shouldGrantCredits,
      rawPayload: parsed.data as Prisma.InputJsonValue,
    });

    return reply.send({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      grantedCredits: result.grantedCredits,
      purchaseId: result.purchase.id,
    });
  });
};
