import assert from "node:assert/strict";
import test from "node:test";
import {
  canRepeatPrivateQaMatch,
  parsePrivateQaRepeatConfig,
} from "./private-qa-repeat.js";

test("parses a private QA repeat configuration", () => {
  const config = parsePrivateQaRepeatConfig({
    generatedBy: "private-qa-match",
    ownerUserId: "owner-1",
    repeatUntilBerlinDate: "2026-08-10",
    sharedInterests: ["Musik", 123, "Reisen"],
  });

  assert.deepEqual(config, {
    ownerUserId: "owner-1",
    repeatUntilBerlinDate: "2026-08-10",
    sharedInterests: ["Musik", "Reisen"],
  });
});

test("rejects invalid or unrelated rationale data", () => {
  assert.equal(parsePrivateQaRepeatConfig(null), null);
  assert.equal(parsePrivateQaRepeatConfig([]), null);
  assert.equal(parsePrivateQaRepeatConfig({ generatedBy: "backend-basic-matchmaking" }), null);
  assert.equal(parsePrivateQaRepeatConfig({
    generatedBy: "private-qa-match",
    ownerUserId: "owner-1",
    repeatUntilBerlinDate: "2026-02-30",
  }), null);
});

test("repeats only for the configured owner and through the final date", () => {
  const config = {
    ownerUserId: "owner-1",
    repeatUntilBerlinDate: "2026-08-10",
    sharedInterests: [],
  };

  assert.equal(canRepeatPrivateQaMatch(config, "owner-1", "2026-08-10"), true);
  assert.equal(canRepeatPrivateQaMatch(config, "owner-1", "2026-08-11"), false);
  assert.equal(canRepeatPrivateQaMatch(config, "owner-2", "2026-08-09"), false);
});
