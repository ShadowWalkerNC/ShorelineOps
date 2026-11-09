import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPacketHtml,
  countPacketPages,
  checkNoExternalRefs,
  verifySource,
  renderPreview,
  renderProduction,
  countPdfPages,
  EXPECTED_PAGES,
  WATERMARK_TEXT,
} from "../src/renderer/index.js";
import { SHARED_CSS } from "../src/styles/index.js";
import { renderSR01 } from "../src/templates/sr01.js";
import { renderSR02 } from "../src/templates/sr02.js";
import { renderSR03 } from "../src/templates/sr03.js";
import { renderSR04 } from "../src/templates/sr04.js";
import { renderSR05 } from "../src/templates/sr05.js";
import { renderSR06 } from "../src/templates/sr06.js";
import { renderSR07 } from "../src/templates/sr07.js";
import { renderSR08, dessertsForDay } from "../src/templates/sr08.js";
import { menuContentHash } from "../src/validation/index.js";
import { makeValidMenu, clone } from "./helpers.js";

function sheetHtml(html: string, sheet: string, dayIndex: number | null): string {
  const attr = dayIndex === null ? `data-sheet="${sheet}"` : `data-sheet="${sheet}" data-day-index="${dayIndex}"`;
  const start = html.indexOf(`<div class="page" ${attr}`);
  assert.ok(start >= 0, `missing ${sheet} day=${dayIndex}`);
  const next = html.indexOf('<div class="page"', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

describe("packet structure", () => {
  it("builds exactly 44 pages in SR order", () => {
    const html = buildPacketHtml(makeValidMenu(), { preview: false, selection: { kind: "complete" } });
    assert.equal(countPacketPages(html), EXPECTED_PAGES);
    const order: string[] = [];
    const re = /data-sheet="(SR-\d\d)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) order.push(m[1]!);
    assert.equal(order.length, 44);
    assert.equal(order[0], "SR-01");
    assert.equal(order[1], "SR-02");
    const expectedTail: string[] = [];
    for (let d = 0; d < 7; d++) expectedTail.push("SR-03", "SR-04", "SR-05", "SR-06", "SR-07", "SR-08");
    assert.deepEqual(order.slice(2), expectedTail);
  });
  it("preview is watermarked, production is not", () => {
    const preview = buildPacketHtml(makeValidMenu(), { preview: true, selection: { kind: "complete" } });
    assert.ok(preview.includes(WATERMARK_TEXT));
    assert.ok(preview.includes("REVIEW ONLY"));
    assert.ok(preview.includes("NOT FOR PRODUCTION"));
    const prod = buildPacketHtml(makeValidMenu(), { preview: false, selection: { kind: "complete" } });
    assert.ok(!prod.includes("REVIEW ONLY"));
    assert.ok(!prod.includes("NOT FOR PRODUCTION"));
  });
  it("contains no external refs or scripts", () => {
    const html = buildPacketHtml(makeValidMenu(), { preview: true, selection: { kind: "complete" } });
    assert.doesNotThrow(() => checkNoExternalRefs(html));
    assert.ok(!html.toLowerCase().includes("<script"));
  });
  it("uses fixed print boxes and >=10pt fonts", () => {
    assert.ok(SHARED_CSS.includes("7.7in"));
    assert.ok(SHARED_CSS.includes("10.2in"));
    const sizes = [...SHARED_CSS.matchAll(/font-size:\s*([\d.]+)pt/g)].map((x) => Number(x[1]));
    assert.ok(sizes.length > 0);
    for (const s of sizes) assert.ok(s >= 10, `font ${s}pt below 10pt`);
  });
  it("all pages carry blank counts (not zero) and no checkboxes", () => {
    const html = buildPacketHtml(makeValidMenu(), { preview: false, selection: { kind: "complete" } });
    assert.ok(html.includes("count-box"));
    assert.ok(!html.includes('type="checkbox"'));
    assert.ok(!html.includes("<input"));
    const boxes = [...html.matchAll(/class="count-box">([^<]*)</g)].map((x) => x[1]!.trim());
    assert.ok(boxes.length > 50);
    for (const b of boxes) {
      assert.ok(b === "" || b === "&nbsp;", `count box must be blank, got ${JSON.stringify(b)}`);
    }
  });
});

describe("component escaping", () => {
  it("escapes special characters in menu text", () => {
    const html = buildPacketHtml(makeValidMenu(), { preview: false, selection: { kind: "complete" } });
    assert.ok(html.includes("Eggs &amp; Toast"));
    assert.ok(html.includes("Milk &lt;2%&gt;"));
    assert.ok(!html.includes("Eggs & Toast"));
    assert.ok(!html.includes("Milk <2%>"));
  });
});

describe("SR-01 weekly menu", () => {
  it("has 7 rows x 3 meal columns with A/B circles and blanks", () => {
    const sr = renderSR01(makeValidMenu());
    assert.ok(sr.includes("Breakfast") && sr.includes("Lunch") && sr.includes("Dinner"));
    const circlesA = (sr.match(/<span class="circle">A<\/span>/g) ?? []).length;
    const circlesB = (sr.match(/<span class="circle">B<\/span>/g) ?? []).length;
    assert.equal(circlesA, 21);
    assert.equal(circlesB, 21);
    assert.ok(sr.includes("Resident"));
    assert.ok(sr.includes("Room"));
    assert.ok(sr.includes("Notes"));
    assert.ok(sr.includes("Caregiver initials"));
  });
});

describe("SR-02 count sheet", () => {
  it("has exactly 6 count columns and no totals", () => {
    const sr = renderSR02(makeValidMenu());
    for (const h of ["Breakfast A", "Breakfast B", "Lunch A", "Lunch B", "Dinner A", "Dinner B"]) {
      assert.ok(sr.includes(h), `missing ${h}`);
    }
    assert.ok(!sr.toLowerCase().includes("total"));
    assert.ok(sr.includes("Missing selections"));
    assert.ok(sr.includes("Tally initials"));
    assert.ok(sr.includes("Review initials"));
  });
});

describe("SR-03 daily summary", () => {
  it("shows all meal options with blank counts and no math", () => {
    const menu = makeValidMenu();
    const sr = renderSR03(menu, 0);
    assert.ok(sr.includes("Breakfast") && sr.includes("Lunch") && sr.includes("Dinner"));
    assert.ok(sr.includes("A count") && sr.includes("B count"));
    assert.ok(sr.includes("Staff count") && sr.includes("Guest / Extra count"));
    assert.ok(!sr.toLowerCase().includes("total"));
    const textOnly = sr.replace(/<[^>]*>/g, " ");
    assert.ok(!textOnly.includes("="), "visible text must not contain =");
  });
});

describe("SR-04 pull and prep", () => {
  it("is blank with separated prep sections and no food tasks", () => {
    const menu = makeValidMenu();
    const sr = renderSR04(menu, 0);
    assert.ok(sr.includes("Pull list"));
    assert.ok(sr.includes("Breakfast prep"));
    assert.ok(sr.includes("Lunch prep"));
    assert.ok(sr.includes("Dinner prep"));
    assert.ok(sr.includes("Extra prep"));
    assert.ok(sr.includes("Shortages / Notes"));
    for (const food of ["Oatmeal", "Chicken Soup", "Beef Stew", "Pasta", "Tuna Salad"]) {
      assert.ok(!sr.includes(food), `SR-04 must not invent tasks from foods (${food})`);
    }
  });
});

describe("SR-05..07 meal service", () => {
  it("shows both options with ordered items and blanks, no facility counts", () => {
    const menu = makeValidMenu();
    const cases: [string, (m: typeof menu, d: number) => string][] = [
      ["SR-05", renderSR05],
      ["SR-06", renderSR06],
      ["SR-07", renderSR07],
    ];
    for (const [code, fn] of cases) {
      const sr = fn(menu, 0);
      assert.ok(sr.includes("Option A"), `${code} missing Option A`);
      assert.ok(sr.includes("Option B"), `${code} missing Option B`);
      assert.ok(sr.includes("Cook initials"), `${code} missing cook initials`);
      assert.ok(sr.includes("Specials / Notes"), `${code} missing specials`);
      for (const bad of [">RM<", ">EP<", "RM count", "EP count", "RM/EP"]) {
        assert.ok(!sr.includes(bad), `${code} must not contain ${bad}`);
      }
    }
    const sr5 = renderSR05(menu, 0);
    const iOat = sr5.indexOf("Oatmeal");
    const iMilk = sr5.indexOf("Milk", iOat + 1);
    const iFruit = sr5.indexOf("Fruit Cup");
    assert.ok(iOat >= 0 && iMilk > iOat && iFruit > iMilk, "SR-05 items must preserve order");
  });
});

describe("SR-08 desserts", () => {
  it("lists only classified desserts with source labels and blank tasks", () => {
    const menu = makeValidMenu();
    const d0 = dessertsForDay(menu, 0).map((d) => d.text);
    assert.ok(d0.includes("Pudding Cup"));
    assert.ok(d0.includes("Cookie"));
    const sr = renderSR08(menu, 0);
    assert.ok(sr.includes("Pudding Cup"));
    assert.ok(sr.includes("Cookie"));
    assert.ok(!sr.includes("Chicken Soup"));
    assert.ok(!sr.includes("Beef Stew"));
    assert.ok(sr.includes("Lunch A") || sr.includes("From"));
    assert.ok(sr.includes("Completion time"));
    assert.ok(sr.includes("Cold prep"));
    assert.ok(sr.includes("Future prep"));
  });
});

describe("source verification", () => {
  it("passes for the synthetic source file and hash", async () => {
    const menu = makeValidMenu();
    const used = await verifySource(menu, process.cwd());
    assert.ok(used.length > 0);
  });
  it("fails when the source file is missing", async () => {
    const menu = makeValidMenu({ sourceFile: "tests/fixtures/does-not-exist.bin" });
    await assert.rejects(() => verifySource(menu, process.cwd()), /not found/);
  });
  it("fails when the hash mismatches", async () => {
    const menu = makeValidMenu({ sha256: "0".repeat(64) });
    await assert.rejects(() => verifySource(menu, process.cwd()), /mismatch/);
  });
});

describe("production gating", () => {
  it("fails without approval", async () => {
    const menu = makeValidMenu();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-"));
    await assert.rejects(
      () => renderProduction(menu, process.cwd(), path.join(dir, "out.pdf")),
      /approval is missing/
    );
  });
  it("fails with unresolved fields", async () => {
    const menu = makeValidMenu();
    menu.days[0]!.meals.breakfast.a.text.needsReview = true;
    const h = menuContentHash(menu);
    menu.approval = { reviewer: "Synthetic Reviewer", approvedAt: new Date().toISOString(), menuHash: h };
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-"));
    await assert.rejects(
      () => renderProduction(menu, process.cwd(), path.join(dir, "out.pdf")),
      /unresolved/
    );
  });
  it("fails with stale approval", async () => {
    const menu = makeValidMenu();
    const h = menuContentHash(menu);
    menu.approval = { reviewer: "Synthetic Reviewer", approvedAt: new Date().toISOString(), menuHash: h };
    menu.days[0]!.meals.breakfast.a.items[0]!.text.value = "Stale Change";
    menu.days[0]!.meals.breakfast.a.items[0]!.text.originalText = "Stale Change";
    menu.days[0]!.meals.breakfast.a.text.value = "Stale Change, Milk, Fruit Cup";
    menu.days[0]!.meals.breakfast.a.text.originalText = "Stale Change, Milk, Fruit Cup";
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-"));
    await assert.rejects(
      () => renderProduction(menu, process.cwd(), path.join(dir, "out.pdf")),
      /stale/
    );
  });
});

describe("playwright PDF (synthetic preview)", () => {
  it("renders 44-page watermarked PDF without overflow", async () => {
    const menu = makeValidMenu();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-preview-"));
    const pdfPath = path.join(dir, "review.pdf");
    const htmlPath = path.join(dir, "packet.html");
    await renderPreview(menu, process.cwd(), pdfPath, htmlPath, { kind: "complete" });
    const html = await fs.readFile(htmlPath, "utf8");
    assert.ok(html.includes(WATERMARK_TEXT));
    assert.equal(countPacketPages(html), 44);
    const stat = await fs.stat(pdfPath);
    assert.ok(stat.size > 10000, `PDF too small: ${stat.size}`);
    assert.equal(await countPdfPages(pdfPath), 44);
  });
  it("renders 44-page production PDF for approved synthetic menu", async () => {
    const menu = makeValidMenu();
    const h = menuContentHash(menu);
    menu.approval = { reviewer: "Synthetic Reviewer", approvedAt: new Date().toISOString(), menuHash: h };
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-prod-"));
    const pdfPath = path.join(dir, "prod.pdf");
    const menuClone = clone(menu);
    const { renderProduction: prod } = await import("../src/renderer/index.js");
    await prod(menuClone, process.cwd(), pdfPath, { kind: "complete" });
    assert.equal(await countPdfPages(pdfPath), 44);
  });
});

describe("packet order details", () => {
  it("places SR sheets in day order", () => {
    const html = buildPacketHtml(makeValidMenu(), { preview: false, selection: { kind: "complete" } });
    const sr03d0 = sheetHtml(html, "SR-03", 0);
    assert.ok(sr03d0.includes("Sunday"));
    const sr08d6 = sheetHtml(html, "SR-08", 6);
    assert.ok(sr08d6.includes("Saturday"));
  });
});
