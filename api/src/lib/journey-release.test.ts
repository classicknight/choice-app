import assert from "node:assert/strict";
import test from "node:test";
import { resolveNextJourneyReleaseAt } from "./journey.js";

test("releases a first match immediately when a candidate appears during the daily window", () => {
  const afternoonInBerlin = new Date("2026-08-10T12:00:00.000Z");

  assert.equal(
    resolveNextJourneyReleaseAt(afternoonInBerlin, null).toISOString(),
    "2026-08-10T07:00:00.000Z",
  );
});

test("schedules a consciously requested replacement for the following morning", () => {
  const afternoonInBerlin = new Date("2026-08-10T12:00:00.000Z");

  assert.equal(
    resolveNextJourneyReleaseAt(afternoonInBerlin, afternoonInBerlin).toISOString(),
    "2026-08-11T07:00:00.000Z",
  );
});

test("waits until the following morning when the daily window has closed", () => {
  const lateEveningInBerlin = new Date("2026-08-10T20:00:00.000Z");

  assert.equal(
    resolveNextJourneyReleaseAt(lateEveningInBerlin, null).toISOString(),
    "2026-08-11T07:00:00.000Z",
  );
});
