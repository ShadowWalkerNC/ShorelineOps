import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { makeValidMenu } from "./helpers.js";
import { buildPacketHtml, renderPdfFromHtml, renderPreview } from "../src/renderer/index.js";
const exec = promisify(execFile);
async function scratch(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-safety-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
test("oversized menu fails before creating a clipped PDF", async t => {
  const dir = await scratch(t);
  const menu = makeValidMenu();
  const choice = menu.days[0]!.meals.breakfast.a;
  const long = "Long synthetic menu component ".repeat(200);
  choice.text.value = choice.text.originalText = long;
  choice.items = [{ text: { ...choice.items[0]!.text, value:long, originalText:long }, kind:"unspecified" }];
  const pdf = path.join(dir,"overflow.pdf");
  await assert.rejects(() => renderPreview(menu, process.cwd(), pdf, path.join(dir,"preview.html")), /overflow|layout failure/);
  await assert.rejects(() => fs.access(pdf));
});
test("renderer rejects sub-10pt print text", async t => {
  const dir = await scratch(t);
  const html = buildPacketHtml(makeValidMenu(), { preview:true }).replaceAll("font-size: 10pt", "font-size: 9pt");
  await assert.rejects(() => renderPdfFromHtml(html,path.join(dir,"tiny.pdf")), /below 10pt/);
});
test("preview refuses missing authoritative source without a PDF", async t => {
  const dir = await scratch(t);
  const menu = makeValidMenu({ sourceFile:"tests/fixtures/missing-source.jpg" });
  await assert.rejects(() => renderPreview(menu,process.cwd(),path.join(dir,"review.pdf"),path.join(dir,"review.html")), /not found/);
  await assert.rejects(() => fs.access(path.join(dir,"review.pdf")));
});
test("CLI cannot approve a missing or changed authoritative source", async t => {
  const dir = await scratch(t);
  for (const menu of [makeValidMenu({sourceFile:"tests/fixtures/missing-source.jpg"}), makeValidMenu({sha256:"0".repeat(64)})]) {
    const input = path.join(dir,"menu.json");
    const output = path.join(dir,"approved.json");
    await fs.writeFile(input,JSON.stringify(menu));
    await assert.rejects(() => exec(process.execPath,[path.resolve("dist/src/cli/index.js"),"approve","--menu",input,"--reviewer","SYNTHETIC TEST ONLY","--confirm-all-42-reviewed","--out",output]));
    await assert.rejects(() => fs.access(output));
  }
});
