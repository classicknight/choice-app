import assert from "node:assert/strict";
import test from "node:test";
import {
  getVerificationStartRetryAfterSeconds,
  VERIFICATION_START_WINDOW_MS,
} from "./verification-rate-limit.js";

test("allows fewer than three verification starts in the active window", () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  const retryAfter = getVerificationStartRetryAfterSeconds([
    new Date(now.getTime() - 20_000),
    new Date(now.getTime() - 10_000),
  ], now);

  assert.equal(retryAfter, null);
});

test("blocks the fourth verification start until the oldest relevant start expires", () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  const retryAfter = getVerificationStartRetryAfterSeconds([
    new Date(now.getTime() - 30 * 60 * 1000),
    new Date(now.getTime() - 20 * 60 * 1000),
    new Date(now.getTime() - 10 * 60 * 1000),
  ], now);

  assert.equal(retryAfter, 30 * 60);
});

test("ignores starts outside the active window", () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  const retryAfter = getVerificationStartRetryAfterSeconds([
    new Date(now.getTime() - VERIFICATION_START_WINDOW_MS - 1),
    new Date(now.getTime() - 20_000),
    new Date(now.getTime() - 10_000),
  ], now);

  assert.equal(retryAfter, null);
});
