import assert from "node:assert/strict";
import test from "node:test";
import {
  CHOICE_PLUS_ENTITLEMENT_ID,
  CHOICE_PLUS_MONTHLY_PRODUCT_ID,
  getPurchaseCatalog,
  isChoicePlusEvent,
  isMatchPackEvent,
} from "./purchases.js";

test("publishes Choice Plus as a monthly subscription", () => {
  const product = getPurchaseCatalog().find((entry) => entry.id === CHOICE_PLUS_MONTHLY_PRODUCT_ID);

  assert.ok(product);
  assert.equal(product.type, "subscription");
  assert.equal(product.displayPrice, "9,99 € / Monat");
});

test("recognizes Choice Plus by product or entitlement", () => {
  assert.equal(isChoicePlusEvent(CHOICE_PLUS_MONTHLY_PRODUCT_ID), true);
  assert.equal(isChoicePlusEvent("another_product", [CHOICE_PLUS_ENTITLEMENT_ID]), true);
  assert.equal(isChoicePlusEvent("match_pack_8"), false);
});

test("only accepts the configured match pack product", () => {
  assert.equal(isMatchPackEvent("match_pack_8"), true);
  assert.equal(isMatchPackEvent("test_product"), false);
});
