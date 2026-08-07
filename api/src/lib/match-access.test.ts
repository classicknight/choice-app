import assert from "node:assert/strict";
import test from "node:test";
import {
  canUserReceiveAnotherMatch,
  getReconciledTotalMatchCount,
} from "./match-access.js";

test("repairs a stale phone counter from durable match evidence", () => {
  assert.equal(getReconciledTotalMatchCount(1, 2, 3), 3);
});

test("never lowers an existing lifetime match count", () => {
  assert.equal(getReconciledTotalMatchCount(10, 2, 3), 10);
});

test("allows an active Choice Plus account after the included matches are used", () => {
  assert.equal(
    canUserReceiveAnotherMatch(
      {
        phoneNumber: "+491759659954",
        paidMatchCredits: 0,
        isPremium: true,
      },
      8,
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
      8,
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
      8,
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
      12,
    ),
    true,
  );
});
