import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { menuContentHash, assertApproved, validateMenu } from "../src/validation/index.js";
import { makeValidMenu, clone } from "./helpers.js";

describe("menuContentHash", () => {
  it("is stable and excludes approval", () => {
    const m = makeValidMenu();
    const h1 = menuContentHash(m);
    const h2 = menuContentHash(clone(m));
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
    const approved = clone(m);
    approved.approval = { reviewer: "Synthetic Reviewer", approvedAt: new Date().toISOString(), menuHash: h1 };
    assert.equal(menuContentHash(approved), h1);
  });
  it("changes when content changes", () => {
    const m = makeValidMenu();
    const h1 = menuContentHash(m);
    const m2 = clone(m);
    m2.days[0]!.meals.breakfast.a.items[0]!.text.value = "Altered Oatmeal";
    m2.days[0]!.meals.breakfast.a.items[0]!.text.originalText = "Altered Oatmeal";
    m2.days[0]!.meals.breakfast.a.text.value = "Altered Oatmeal, Milk, Fruit Cup";
    m2.days[0]!.meals.breakfast.a.text.originalText = "Altered Oatmeal, Milk, Fruit Cup";
    const v = validateMenu(m2);
    assert.equal(v.ok, true);
    assert.notEqual(menuContentHash(m2), h1);
  });
});

describe("assertApproved", () => {
  it("requires approval (missing fails)", () => {
    const m = makeValidMenu();
    assert.throws(() => assertApproved(m), /approval is missing/);
  });
  it("requires no unresolved fields", () => {
    const m = makeValidMenu();
    m.days[0]!.date.needsReview = true;
    const h = menuContentHash(m);
    m.approval = { reviewer: "R", approvedAt: new Date().toISOString(), menuHash: h };
    assert.throws(() => assertApproved(m), /unresolved/);
  });
  it("accepts current synthetic approval", () => {
    const m = makeValidMenu();
    const h = menuContentHash(m);
    m.approval = { reviewer: "Synthetic Reviewer", approvedAt: new Date().toISOString(), menuHash: h };
    assert.doesNotThrow(() => assertApproved(m));
  });
  it("rejects stale approval after content change", () => {
    const m = makeValidMenu();
    const h = menuContentHash(m);
    m.approval = { reviewer: "Synthetic Reviewer", approvedAt: new Date().toISOString(), menuHash: h };
    assert.doesNotThrow(() => assertApproved(m));
    m.days[1]!.meals.lunch.b.items[0]!.text.value = "Changed Tuna";
    m.days[1]!.meals.lunch.b.items[0]!.text.originalText = "Changed Tuna";
    m.days[1]!.meals.lunch.b.text.value = "Changed Tuna, Chips";
    m.days[1]!.meals.lunch.b.text.originalText = "Changed Tuna, Chips";
    assert.throws(() => assertApproved(m), /stale/);
  });
});
