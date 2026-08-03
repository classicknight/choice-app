import assert from "node:assert/strict";
import test from "node:test";
import { isSeedDemoAccountEmail } from "./synthetic-accounts.js";

test("recognizes only isolated seed demo accounts", () => {
  assert.equal(isSeedDemoAccountEmail("mila.demo@choice.local"), true);
  assert.equal(isSeedDemoAccountEmail("apple@choice-review.local"), false);
  assert.equal(isSeedDemoAccountEmail("person@example.com"), false);
  assert.equal(isSeedDemoAccountEmail(null), false);
});
