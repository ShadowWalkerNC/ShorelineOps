import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateMenu, countOptions, listUnresolvedFields } from "../src/validation/index.js";
import { makeValidMenu, clone, SYNTHETIC_SOURCE_REL } from "./helpers.js";

describe("validateMenu: valid synthetic menu", () => {
  it("accepts the valid synthetic menu with 42 options and no unresolved fields", () => {
    const menu = makeValidMenu();
    const v = validateMenu(menu);
    assert.equal(v.ok, true, v.ok ? "" : v.errors.join("; "));
    if (v.ok) {
      assert.equal(countOptions(v.menu), 42);
      assert.deepEqual(listUnresolvedFields(v.menu), []);
    }
  });
});

describe("validateMenu: missing fields/days/meals/options", () => {
  it("rejects missing days", () => {
    const m = clone(makeValidMenu()) as Record<string, unknown>;
    delete m["days"];
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects wrong day count", () => {
    const m = clone(makeValidMenu());
    m.days = m.days.slice(0, 6);
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects empty items", () => {
    const m = clone(makeValidMenu());
    m.days[0]!.meals.breakfast.a.items = [];
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects empty field value", () => {
    const m = clone(makeValidMenu());
    m.days[0]!.meals.breakfast.a.text.value = "";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects empty originalText", () => {
    const m = clone(makeValidMenu());
    m.days[1]!.meals.lunch.b.items[0]!.text.originalText = "   ";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects missing metadata", () => {
    const m = clone(makeValidMenu()) as unknown as Record<string, unknown>;
    const rec = m as { metadata?: unknown };
    delete rec.metadata;
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
});

describe("validateMenu: dates and metadata consistency", () => {
  it("rejects invalid calendar date", () => {
    const m = clone(makeValidMenu());
    m.days[2]!.date.value = "2026-02-30";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.errors.join("; "), /real calendar date/);
  });
  it("rejects non-consecutive dates", () => {
    const m = clone(makeValidMenu());
    m.days[3]!.date.value = "2026-11-05";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects week not starting Sunday", () => {
    const m = clone(makeValidMenu());
    m.startDate = "2026-10-26";
    m.metadata.startDate.value = "2026-10-26";
    m.days[0]!.date.value = "2026-10-26";
    m.days[1]!.date.value = "2026-10-27";
    m.days[2]!.date.value = "2026-10-28";
    m.days[3]!.date.value = "2026-10-29";
    m.days[4]!.date.value = "2026-10-30";
    m.days[5]!.date.value = "2026-10-31";
    m.days[6]!.date.value = "2026-11-01";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.errors.join("; "), /Sunday/);
  });
  it("rejects metadata week mismatch", () => {
    const m = clone(makeValidMenu());
    m.metadata.week.value = "2";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects metadata startDate mismatch", () => {
    const m = clone(makeValidMenu());
    m.metadata.startDate.value = "2026-10-26";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects non-positive and non-integer week", () => {
    for (const w of [0, -1, 1.5]) {
      const m = clone(makeValidMenu());
      m.week = w;
      m.metadata.week.value = String(w);
      const v = validateMenu(m);
      assert.equal(v.ok, false, `week=${w} should fail`);
    }
  });
});

describe("validateMenu: source refs and hashes", () => {
  it("rejects field source.file disagreeing with source.file", () => {
    const m = clone(makeValidMenu());
    m.days[0]!.meals.breakfast.a.text.source.file = "other/file.jpg";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.errors.join("; "), /must agree with source\.file/);
  });
  it("rejects layout references as source", () => {
    for (const f of [
      "fixtures/references/workflow-preview.jpg",
      "fixtures/references/resident-tally-preview.jpg",
      "some/References/copy.jpg",
    ]) {
      const m = clone(makeValidMenu({ sourceFile: f }));
      for (const d of m.days) {
        d.date.source.file = f;
        for (const meal of [d.meals.breakfast, d.meals.lunch, d.meals.dinner]) {
          for (const opt of [meal.a, meal.b]) {
            opt.text.source.file = f;
            for (const it of opt.items) it.text.source.file = f;
          }
        }
      }
      m.metadata.week.source.file = f;
      m.metadata.startDate.source.file = f;
      const v = validateMenu(m);
      assert.equal(v.ok, false, `source ${f} should fail`);
      if (!v.ok) assert.match(v.errors.join("; "), /layout/);
    }
  });
  it("rejects malformed sha256", () => {
    const m = clone(makeValidMenu());
    m.source.sha256 = "not-a-hash";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("synthetic source ref is not under fixtures/", () => {
    assert.ok(!SYNTHETIC_SOURCE_REL.startsWith("fixtures/"));
  });
});

describe("validateMenu: option/item agreement and confidence", () => {
  it("rejects altered components (value mismatch)", () => {
    const m = clone(makeValidMenu());
    m.days[0]!.meals.lunch.a.items[0]!.text.value = "Something Else Entirely";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.errors.join("; "), /must agree/);
  });
  it("rejects altered originalText", () => {
    const m = clone(makeValidMenu());
    m.days[0]!.meals.dinner.a.items[1]!.text.originalText = "Changed Wording";
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects out-of-range confidence", () => {
    for (const c of [-0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const m = clone(makeValidMenu());
      m.days[0]!.meals.breakfast.a.text.confidence = c;
      const v = validateMenu(m);
      assert.equal(v.ok, false, `confidence=${String(c)} should fail`);
    }
  });
  it("accepts null and boundary confidence", () => {
    const m = clone(makeValidMenu());
    m.days[0]!.meals.breakfast.a.text.confidence = 0;
    m.days[0]!.meals.breakfast.b.text.confidence = 1;
    m.days[0]!.meals.lunch.a.text.confidence = null;
    const v = validateMenu(m);
    assert.equal(v.ok, true, v.ok ? "" : v.errors.join("; "));
  });
});

describe("validateMenu: unknown fields rejected", () => {
  it("rejects unknown top-level field", () => {
    const m = clone(makeValidMenu()) as unknown as Record<string, unknown>;
    m["extra"] = 1;
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
  it("rejects unknown nested field", () => {
    const m = clone(makeValidMenu()) as unknown as Record<string, unknown>;
    const days = m["days"] as Record<string, unknown>[];
    const meals = (days[0] as Record<string, unknown>)["meals"] as Record<string, unknown>;
    const bf = meals["breakfast"] as Record<string, unknown>;
    const a = bf["a"] as Record<string, unknown>;
    a["unexpected"] = true;
    const v = validateMenu(m);
    assert.equal(v.ok, false);
  });
});

describe("validateMenu: unresolved tracking", () => {
  it("lists needsReview fields", () => {
    const m = clone(makeValidMenu());
    m.days[2]!.meals.dinner.b.text.needsReview = true;
    const v = validateMenu(m);
    assert.equal(v.ok, true);
    if (v.ok) {
      const u = listUnresolvedFields(v.menu);
      assert.equal(u.length, 1);
      assert.match(u[0]!, /days\[2\]/);
    }
  });
});
