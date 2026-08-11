import assert from "node:assert/strict";
import test from "node:test";
import {
  canUserReceiveAnotherMatch,
  getMeteredMatchCount,
  getMonthlyFreeMatchState,
  getNextMatchAccessSource,
  getNextMonthlyFreeMatchPeriod,
  getReconciledTotalMatchCount,
  shouldCountMatchForUser,
  type PhoneMatchUsage,
} from "./match-access.js";

function createUsage(overrides: Partial<PhoneMatchUsage> = {}): PhoneMatchUsage {
  return {
    totalMatchCount: 8,
    choicePlusMatchCount: 0,
    meteredMatchCount: 8,
    monthlyFreeMatchCount: 0,
    monthlyFreeMatchEligibleFrom: null,
    monthlyFreeMatchPeriod: null,
    monthlyFreeMatchUsed: 0,
    ...overrides,
  };
}

test("repairs a stale phone counter from durable match evidence", () => {
  assert.equal(getReconciledTotalMatchCount(1, 2, 3), 3);
});

test("never lowers an existing lifetime match count", () => {
  assert.equal(getReconciledTotalMatchCount(10, 2, 3), 10);
});

test("does not count App Review demo matches", () => {
  assert.equal(
    shouldCountMatchForUser("real-user", {
      userAId: "real-user",
      userBId: "review-user",
      userA: { email: null },
      userB: { email: "mila@choice-review.local" },
    }),
    false,
  );
});

test("does not count Choice Plus matches against the regular balance", () => {
  assert.equal(getMeteredMatchCount(12, 4), 8);
});

test("keeps invalid Choice Plus counters inside the lifetime total", () => {
  assert.equal(getMeteredMatchCount(3, 8), 0);
  assert.equal(getMeteredMatchCount(3, -2), 3);
});

test("allows an active Choice Plus account after the included matches are used", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 0,
        isPremium: true,
      },
      createUsage(),
      new Date("2026-08-09T10:00:00.000Z"),
    ),
    true,
  );
});

test("blocks a regular account after all included matches are used", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 0,
        isPremium: false,
      },
      createUsage(),
      new Date("2026-08-09T10:00:00.000Z"),
    ),
    false,
  );
});

test("blocks an expired Choice Plus account when no credits remain", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 0,
        isPremium: true,
        premiumExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      createUsage(),
      new Date("2026-08-09T10:00:00.000Z"),
    ),
    false,
  );
});

test("keeps paid match packs available without Choice Plus", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 1,
        isPremium: false,
      },
      createUsage({ totalMatchCount: 12, meteredMatchCount: 12 }),
      new Date("2026-08-09T10:00:00.000Z"),
    ),
    true,
  );
});

test("uses Plus, starter, monthly, and paid access in that order", () => {
  const now = new Date("2026-08-09T10:00:00.000Z");
  const baseUser = {
    phoneNumber: "+491759659954",
    paidMatchCredits: 1,
    isPremium: false,
  };

  assert.equal(
    getNextMatchAccessSource({ ...baseUser, isPremium: true }, createUsage(), now),
    "choice-plus",
  );
  assert.equal(
    getNextMatchAccessSource(baseUser, createUsage({ meteredMatchCount: 7 }), now),
    "starter",
  );
  assert.equal(
    getNextMatchAccessSource(
      baseUser,
      createUsage({ monthlyFreeMatchEligibleFrom: "2026-08" }),
      now,
    ),
    "monthly-free",
  );
  assert.equal(
    getNextMatchAccessSource(
      baseUser,
      createUsage({
        monthlyFreeMatchEligibleFrom: "2026-08",
        monthlyFreeMatchPeriod: "2026-08",
        monthlyFreeMatchUsed: 2,
      }),
      now,
    ),
    "paid",
  );
});

test("allows two monthly matches after the starter allowance", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 0,
        isPremium: false,
      },
      createUsage({ monthlyFreeMatchEligibleFrom: "2026-08" }),
      new Date("2026-08-09T10:00:00.000Z"),
    ),
    true,
  );
});

test("blocks after both monthly matches are used", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 0,
        isPremium: false,
      },
      createUsage({
        monthlyFreeMatchCount: 2,
        monthlyFreeMatchEligibleFrom: "2026-08",
        monthlyFreeMatchPeriod: "2026-08",
        monthlyFreeMatchUsed: 2,
      }),
      new Date("2026-08-09T10:00:00.000Z"),
    ),
    false,
  );
});

test("refreshes monthly matches without carrying unused credits forward", () => {
  const state = getMonthlyFreeMatchState(
    createUsage({
      monthlyFreeMatchEligibleFrom: "2026-08",
      monthlyFreeMatchPeriod: "2026-08",
      monthlyFreeMatchUsed: 1,
    }),
    new Date("2026-09-01T10:00:00.000Z"),
  );

  assert.equal(state.used, 0);
  assert.equal(state.remaining, 2);
});

test("starts monthly matches in the month after a new user finishes the starter allowance", () => {
  const augustState = getMonthlyFreeMatchState(
    createUsage({ monthlyFreeMatchEligibleFrom: "2026-09" }),
    new Date("2026-08-31T10:00:00.000Z"),
  );
  const septemberState = getMonthlyFreeMatchState(
    createUsage({ monthlyFreeMatchEligibleFrom: "2026-09" }),
    new Date("2026-09-01T10:00:00.000Z"),
  );

  assert.equal(augustState.remaining, 0);
  assert.equal(septemberState.remaining, 2);
  assert.equal(getNextMonthlyFreeMatchPeriod("2026-12"), "2027-01");
});
