import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeValidMenu, clone } from "./helpers.js";
import { menuContentHash } from "../src/validation/index.js";

const execFileAsync = promisify(execFile);
const CLI = path.resolve(process.cwd(), "dist/src/cli/index.js");

async function writeTempMenu(menu: unknown): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sylvia-cli-"));
  const p = path.join(dir, "menu.json");
  await fs.writeFile(p, JSON.stringify(menu, null, 2), "utf8");
  return p;
}

describe("CLI validate", () => {
  it("exits 0 for a valid synthetic menu", async () => {
    const p = await writeTempMenu(makeValidMenu());
    const { stdout } = await execFileAsync(process.execPath, [CLI, "validate", "--menu", p]);
    assert.match(stdout, /VALID/);
  });
  it("exits nonzero for an invalid menu", async () => {
    const m = clone(makeValidMenu());
    m.days = m.days.slice(0, 3);
    const p = await writeTempMenu(m);
    await assert.rejects(() => execFileAsync(process.execPath, [CLI, "validate", "--menu", p]));
  });
});

describe("CLI approve", () => {
  it("requires explicit reviewer and --confirm-all-42-reviewed", async () => {
    const p = await writeTempMenu(makeValidMenu());
    await assert.rejects(() =>
      execFileAsync(process.execPath, [CLI, "approve", "--menu", p, "--confirm-all-42-reviewed"])
    );
    await assert.rejects(() =>
      execFileAsync(process.execPath, [CLI, "approve", "--menu", p, "--reviewer", "Human Reviewer"])
    );
  });
  it("binds the current content hash on synthetic approval", async () => {
    const menu = makeValidMenu();
    const expected = menuContentHash(menu);
    const p = await writeTempMenu(menu);
    const out = `${p}.approved.json`;
    const { stdout } = await execFileAsync(process.execPath, [
      CLI,
      "approve",
      "--menu",
      p,
      "--reviewer",
      "Synthetic Reviewer",
      "--confirm-all-42-reviewed",
      "--out",
      out,
    ]);
    assert.match(stdout, /APPROVED/);
    const approved = JSON.parse(await fs.readFile(out, "utf8")) as typeof menu;
    assert.equal(approved.approval?.reviewer, "Synthetic Reviewer");
    assert.equal(approved.approval?.menuHash, expected);
  });
  it("refuses to approve menus with unresolved fields", async () => {
    const menu = makeValidMenu();
    menu.days[0]!.meals.breakfast.a.text.needsReview = true;
    const p = await writeTempMenu(menu);
    await assert.rejects(() =>
      execFileAsync(process.execPath, [
        CLI,
        "approve",
        "--menu",
        p,
        "--reviewer",
        "Human Reviewer",
        "--confirm-all-42-reviewed",
        "--out",
        `${p}.out.json`,
      ])
    );
  });
});
