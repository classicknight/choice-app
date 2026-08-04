import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrivateQaAccountEmail,
  isSeedDemoAccountEmail,
  isSyntheticMatchingAccountEmail,
} from "./synthetic-accounts.js";

test("recognizes only isolated seed demo accounts", () => {
  assert.equal(isSeedDemoAccountEmail("mila.demo@choice.local"), true);
  assert.equal(isSeedDemoAccountEmail("apple@choice-review.local"), false);
  assert.equal(isSeedDemoAccountEmail("person@example.com"), false);
  assert.equal(isSeedDemoAccountEmail(null), false);
});

test("keeps private QA partners outside regular matching", () => {
  assert.equal(isPrivateQaAccountEmail("alex-private.qa@choice.local"), true);
  assert.equal(isSyntheticMatchingAccountEmail("alex-private.qa@choice.local"), true);
  assert.equal(isSyntheticMatchingAccountEmail("mila.demo@choice.local"), true);
  assert.equal(isSyntheticMatchingAccountEmail("apple@choice-review.local"), false);
  assert.equal(isSyntheticMatchingAccountEmail("person@example.com"), false);
});
