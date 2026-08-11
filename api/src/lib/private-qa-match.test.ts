import assert from "node:assert/strict";
import test from "node:test";
import {
  getPrivateQaPartnerEmail,
  getPrivateQaProfileForOwner,
  getPrivateQaRepeatUntilDate,
  getUnseenPrivateQaProfileForOwner,
} from "./private-qa-match.js";
import { shouldCountMatchForUser } from "./match-access.js";

test("assigns a stable private QA profile and rotates it by Berlin date", () => {
  const firstProfile = getPrivateQaProfileForOwner("tester-1");
  const repeatedProfile = getPrivateQaProfileForOwner("tester-1");
  const firstDailyProfile = getPrivateQaProfileForOwner("tester-1", "2026-08-11");
  const nextDailyProfile = getPrivateQaProfileForOwner("tester-1", "2026-08-12");
  const firstEmail = getPrivateQaPartnerEmail("tester-1");
  const secondEmail = getPrivateQaPartnerEmail("tester-2");
  const firstDailyEmail = getPrivateQaPartnerEmail("tester-1", firstDailyProfile.id);
  const nextDailyEmail = getPrivateQaPartnerEmail("tester-1", nextDailyProfile.id);

  assert.equal(firstProfile.id, repeatedProfile.id);
  assert.notEqual(firstDailyProfile.id, nextDailyProfile.id);
  assert.match(firstEmail, /\.qa@choice\.local$/);
  assert.notEqual(firstEmail, secondEmail);
  assert.notEqual(firstDailyEmail, nextDailyEmail);
});

test("creates a Berlin repeat date for the configured test window", () => {
  const now = new Date("2026-08-10T10:00:00.000Z");

  assert.equal(getPrivateQaRepeatUntilDate(now, 14), "2026-08-24");
});

test("never returns a private QA profile that the owner has already matched", () => {
  const firstProfile = getPrivateQaProfileForOwner("tester-1", "2026-08-11");
  const nextProfile = getUnseenPrivateQaProfileForOwner(
    "tester-1",
    "2026-08-11",
    new Set([firstProfile.id]),
  );

  assert.ok(nextProfile);
  assert.notEqual(nextProfile.id, firstProfile.id);
});

test("returns no private QA profile after the complete pool was used", () => {
  const seenProfileIds = new Set<string>();

  for (let day = 11; day <= 22; day += 1) {
    const profile = getPrivateQaProfileForOwner("tester-1", `2026-08-${day}`);
    seenProfileIds.add(profile.id);
  }

  assert.equal(
    getUnseenPrivateQaProfileForOwner("tester-1", "2026-08-23", seenProfileIds),
    null,
  );
});

test("private QA and demo matches do not consume the real match allowance", () => {
  const realMatch = {
    userAId: "owner",
    userBId: "real",
    userA: { email: null },
    userB: { email: "person@example.com" },
  };
  const qaMatch = {
    ...realMatch,
    userBId: "qa",
    userB: { email: "tester-owner.qa@choice.local" },
  };
  const demoMatch = {
    ...realMatch,
    userBId: "demo",
    userB: { email: "mila.demo@choice.local" },
  };

  assert.equal(shouldCountMatchForUser("owner", realMatch), true);
  assert.equal(shouldCountMatchForUser("owner", qaMatch), false);
  assert.equal(shouldCountMatchForUser("owner", demoMatch), false);
});
