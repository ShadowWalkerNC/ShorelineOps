#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateMenu, menuContentHash, listUnresolvedFields } from "../validation/index.js";
import { renderPreview, renderProduction, verifySource, type PacketSelection, type DailyExtra } from "../renderer/index.js";
import type { Menu } from "../schema/index.js";

function usage(): string {
  return `sylvia-menu-processor Milestone 1

Usage:
  validate --menu <menu.json>
  preview --menu <menu.json> [--packet weekly|daily|complete] [--date YYYY-MM-DD] [--include summary,prep,dessert] [--out <pdf>] [--html <html>]
  approve --menu <menu.json> --reviewer <name> --confirm-all-42-reviewed [--out <menu.json>]
  generate --menu <menu.json> [--packet weekly|daily|complete] [--date YYYY-MM-DD] [--include summary,prep,dessert] [--out <pdf>]

Defaults:
  weekly: 2 pages (default). daily: 3 cook pages; --date is required.
  Optional daily extras: summary, prep, dessert. complete: 44 pages.
  Output filenames identify the selected packet/date; previews are always watermarked.
`;
}

type Args = { cmd: string; menu: string | null; out: string | null; html: string | null; reviewer: string | null; confirmAll: boolean; packet: string; date: string | null; include: string | null };
function parseArgs(argv: string[]): Args {
  const args: Args = { cmd: argv[0] ?? "", menu: null, out: null, html: null, reviewer: null, confirmAll: false, packet: "weekly", date: null, include: null };
  const seen = new Set<string>();
  for (let i = 1; i < argv.length; i++) {
    const flag = argv[i]!;
    if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
    seen.add(flag);
    if (flag === "--confirm-all-42-reviewed") { args.confirmAll = true; continue; }
    if (!["--menu", "--out", "--html", "--reviewer", "--packet", "--date", "--include"].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    switch (flag) {
      case "--menu": args.menu = value; break;
      case "--out": args.out = value; break;
      case "--html": args.html = value; break;
      case "--reviewer": args.reviewer = value; break;
      case "--packet": args.packet = value; break;
      case "--date": args.date = value; break;
      case "--include": args.include = value; break;
    }
  }
  return args;
}
function packetSelection(args: Args): PacketSelection {
  if (args.packet === "weekly" || args.packet === "complete") {
    if (args.date !== null || args.include !== null) throw new Error("--date and --include are only available with --packet daily");
    return { kind: args.packet };
  }
  if (args.packet !== "daily") throw new Error("--packet must be weekly, daily or complete");
  if (!args.date) throw new Error("Daily packet requires --date YYYY-MM-DD");
  const extras: DailyExtra[] = [];
  for (const value of args.include === null ? [] : args.include.split(",")) {
    if (value !== "summary" && value !== "prep" && value !== "dessert") throw new Error("--include must contain summary, prep or dessert");
    if (extras.includes(value)) throw new Error(`Duplicate daily extra: ${value}`);
    extras.push(value);
  }
  return { kind: "daily", date: args.date, extras: (["summary", "prep", "dessert"] as const).filter(extra => extras.includes(extra)) };
}
function packetStem(menu: Menu, selection: PacketSelection): string {
  if (selection.kind === "weekly") return `sylvia-ross-week-${menu.week}-weekly`;
  if (selection.kind === "complete") return `sylvia-ross-week-${menu.week}`;
  const suffix = selection.extras?.length ? `-with-${selection.extras.join("-")}` : "";
  return `sylvia-ross-${selection.date}-daily${suffix}`;
}

async function loadMenu(menuPath: string): Promise<{ menu: unknown; dir: string }> {
  const abs = path.resolve(process.cwd(), menuPath);
  const raw = await fs.readFile(abs, "utf8");
  return { menu: JSON.parse(raw) as unknown, dir: path.dirname(abs) };
}

async function cmdValidate(menuPath: string): Promise<void> {
  const { menu, dir } = await loadMenu(menuPath);
  const v = validateMenu(menu);
  if (!v.ok) {
    console.error("INVALID");
    for (const e of v.errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }
  await verifySource(v.menu, dir);
  const unresolved = listUnresolvedFields(v.menu);
  console.log(`VALID week=${v.menu.week} startDate=${v.menu.startDate} unresolved=${unresolved.length} hash=${menuContentHash(v.menu)}`);
}

async function cmdPreview(menuPath: string, out: string | null, html: string | null, selection: PacketSelection): Promise<void> {
  const { menu, dir } = await loadMenu(menuPath);
  const v = validateMenu(menu);
  if (!v.ok) {
    console.error("INVALID");
    for (const e of v.errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }
  const stem = packetStem(v.menu, selection);
  const pdfPath = path.resolve(process.cwd(), out ?? `output/preview/${stem}-review.pdf`);
  const htmlPath = path.resolve(process.cwd(), html ?? `output/preview/${stem}.html`);
  await renderPreview(v.menu, dir, pdfPath, htmlPath, selection);
  console.log(`PREVIEW OK ${pdfPath} ${htmlPath}`);
}

async function cmdApprove(
  menuPath: string,
  reviewer: string | null,
  confirmAll: boolean,
  out: string | null
): Promise<void> {
  if (!reviewer || reviewer.trim().length === 0) {
    console.error("approve requires explicit --reviewer <name> (human confirmation only)");
    process.exitCode = 1;
    return;
  }
  if (!confirmAll) {
    console.error("approve requires --confirm-all-42-reviewed (human confirmation only)");
    process.exitCode = 1;
    return;
  }
  const { menu, dir } = await loadMenu(menuPath);
  const v = validateMenu(menu);
  if (!v.ok) {
    console.error("INVALID");
    for (const e of v.errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }
  await verifySource(v.menu, dir);
  const unresolved = listUnresolvedFields(v.menu);
  if (unresolved.length > 0) {
    console.error(`cannot approve: ${unresolved.length} unresolved field(s): ${unresolved.slice(0, 5).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const hash = menuContentHash(v.menu);
  const approved: Menu = {
    ...v.menu,
    approval: {
      reviewer: reviewer.trim(),
      approvedAt: new Date().toISOString(),
      menuHash: hash,
    },
  };
  const outPath = path.resolve(process.cwd(), out ?? "output/approved/week-1.menu.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(approved, null, 2) + "\n", "utf8");
  console.log(`APPROVED reviewer=${reviewer.trim()} hash=${hash} out=${outPath}`);
}

async function cmdGenerate(menuPath: string, out: string | null, selection: PacketSelection): Promise<void> {
  const { menu, dir } = await loadMenu(menuPath);
  const v = validateMenu(menu);
  if (!v.ok) {
    console.error("INVALID");
    for (const e of v.errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }
  const pdfPath = path.resolve(process.cwd(), out ?? `output/${packetStem(v.menu, selection)}.pdf`);
  await renderProduction(v.menu, dir, pdfPath, selection);
  console.log(`GENERATED ${pdfPath}`);
}

export async function main(argv: string[]): Promise<void> {
  try {
  if (argv.includes("--help") || argv.includes("-h")) { console.log(usage()); return; }
  const args = parseArgs(argv);
  if (!args.cmd) {
    console.log(usage());
    process.exitCode = 1;
    return;
  }
  if (!args.menu) {
    console.error(`missing --menu <menu.json>\n${usage()}`);
    process.exitCode = 1;
    return;
  }
    if (args.cmd === "validate") await cmdValidate(args.menu);
    else if (args.cmd === "preview") await cmdPreview(args.menu, args.out, args.html, packetSelection(args));
    else if (args.cmd === "approve") await cmdApprove(args.menu, args.reviewer, args.confirmAll, args.out);
    else if (args.cmd === "generate") await cmdGenerate(args.menu, args.out, packetSelection(args));
    else {
      console.error(`unknown command: ${args.cmd}\n${usage()}`);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("index.js")) {
  await main(process.argv.slice(2));
}
