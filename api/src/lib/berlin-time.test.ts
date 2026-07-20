import assert from "node:assert/strict";
import test from "node:test";
import {
  addBerlinCalendarDaysAtTime,
  getBerlinDateAtTime,
  getBerlinDateKey,
  getNextBerlinDateAtTime,
} from "./berlin-time.js";

test("resolves 09:00 in Berlin while the process may run in UTC", () => {
  const reference = new Date("2026-07-20T21:50:00.000Z");

  assert.equal(getBerlinDateAtTime(reference, 9, 0).toISOString(), "2026-07-20T07:00:00.000Z");
  assert.equal(getNextBerlinDateAtTime(reference, 9, 0).toISOString(), "2026-07-21T07:00:00.000Z");
  assert.equal(getBerlinDateKey(reference), "2026-07-20");
});

test("keeps the release at 09:00 across the start of daylight saving time", () => {
  const saturdayRelease = new Date("2026-03-28T08:00:00.000Z");
  const sundayRelease = addBerlinCalendarDaysAtTime(saturdayRelease, 1, 9, 0);

  assert.equal(sundayRelease.toISOString(), "2026-03-29T07:00:00.000Z");
});

test("keeps the release at 09:00 across the end of daylight saving time", () => {
  const saturdayRelease = new Date("2026-10-24T07:00:00.000Z");
  const sundayRelease = addBerlinCalendarDaysAtTime(saturdayRelease, 1, 9, 0);

  assert.equal(sundayRelease.toISOString(), "2026-10-25T08:00:00.000Z");
});
