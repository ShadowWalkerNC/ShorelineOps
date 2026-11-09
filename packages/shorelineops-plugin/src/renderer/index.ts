import { assertRenderCounts } from "../production/scans.js";
import type { ConfirmedCounts } from "../production/scans.js";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { Menu } from "../schema/index.js";
import { assertApproved, validateMenu } from "../validation/index.js";
import { SHARED_CSS } from "../styles/index.js";
import { resolveResidentArea, resolveWorkArea, type CampusScope, type CampusProfile } from "../campus/index.js";
import { escapeHtml, facilityHeading } from "../templates/html.js";
import { isRealCalendarDate } from "../validation/index.js";
import { renderSR01 } from "../templates/sr01.js";
import { renderSR02 } from "../templates/sr02.js";
import { renderSR03 } from "../templates/sr03.js";
import { renderSR04 } from "../templates/sr04.js";
import { renderSR05 } from "../templates/sr05.js";
import { renderSR06 } from "../templates/sr06.js";
import { renderSR07 } from "../templates/sr07.js";
import { renderSR08 } from "../templates/sr08.js";
import { renderRossWorksheet, type RossWorksheet } from '../templates/ross-worksheets.js';

/** Page count of the optional complete master packet only. */
export const EXPECTED_PAGES = 44;
export type DailyExtra = "summary" | "prep" | "dessert";
export type PacketSelection =
  | { kind: "weekly" }
  | { kind: "daily"; date: string; extras?: DailyExtra[] }
  | { kind: "complete" };
export const DEFAULT_PACKET: PacketSelection = { kind: "weekly" };
export const WATERMARK_TEXT = "REVIEW ONLY / NOT FOR PRODUCTION";

export function resolveSourcePath(sourceFile: string, menuDir: string): string {
  if (path.isAbsolute(sourceFile)) return sourceFile;
  const fromMenuDir = path.resolve(menuDir, sourceFile);
  return fromMenuDir;
}

export function candidateSourcePaths(sourceFile: string, menuDir: string): string[] {
  if (path.isAbsolute(sourceFile)) return [sourceFile];
  const out: string[] = [];
  out.push(path.resolve(menuDir, sourceFile));
  const cwdResolved = path.resolve(process.cwd(), sourceFile);
  if (!out.includes(cwdResolved)) out.push(cwdResolved);
  return out;
}

export async function verifySource(menu: Menu, menuDir: string): Promise<string> {
  const candidates = candidateSourcePaths(menu.source.file, menuDir);
  let bytes: Buffer | null = null;
  let used: string | null = null;
  let lastErr: unknown = null;
  for (const p of candidates) {
    try {
      bytes = await fs.readFile(p);
      used = p;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!bytes || !used) {
    throw new Error(
      `source file not found: ${menu.source.file} (tried ${candidates.join(", ")}): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
    );
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash.toLowerCase() !== menu.source.sha256.toLowerCase()) {
    throw new Error(
      `source hash mismatch for ${menu.source.file}: expected ${menu.source.sha256}, got ${hash}`
    );
  }
  return used;
}

function wrapPage(sheet: string, dayIndex: number | null, inner: string, preview: boolean, areaLabel?: string, menuSource?: string): string {
  if (areaLabel) inner = inner.replace(/<p class="facility">[^<]*<\/p>/, `<p class="facility">${escapeHtml(areaLabel)}</p>`);
  if (menuSource) inner = `<p class="small-note" style="margin:0 0 0.04in">Shared menu source: ${escapeHtml(menuSource)}</p>${inner}`;
  const banner = preview
    ? `<div class="review-banner">${WATERMARK_TEXT}</div>`
    : "";
  const watermark = preview
    ? `<div class="watermark" aria-hidden="true"><span>REVIEW ONLY</span><span>NOT FOR PRODUCTION</span></div>`
    : "";
  const dayAttr = dayIndex === null ? "" : ` data-day-index="${dayIndex}"`;
  return `<div class="page" data-sheet="${sheet}"${dayAttr}>${banner}${inner}${watermark}</div>`;
}

export function buildPacketHtml(menu: Menu, opts: { preview: boolean; selection?: PacketSelection; scope?: CampusScope; counts?: ConfirmedCounts }): string {
  const validated = validateMenu(menu);
  if (!validated.ok) throw new Error(`Invalid menu: ${validated.errors.join("; ")}`);
  const resolved = opts.scope ? resolveResidentArea(menu, opts.scope, opts.preview) : undefined;
  const wrap = (sheet: string, index: number | null, inner: string, preview: boolean) => wrapPage(sheet,index,inner,preview,resolved?.area.name,resolved?.shared ? facilityHeading(menu) : undefined);
  const selection = opts.selection ?? DEFAULT_PACKET;
  if(opts.counts)assertRenderCounts(menu,opts.counts,opts.scope?.residentAreaId??menu.facility);
  const pages: string[] = [];
  const weekly = () => {
    pages.push(wrap("SR-01", null, renderSR01(menu), opts.preview));
    pages.push(wrap("SR-02", null, renderSR02(menu), opts.preview));
  };
  const daily = (index: number, extras: DailyExtra[]) => {
    const counts=opts.counts?.days[menu.days[index]!.date.value];
    if(opts.counts&&!counts)throw new Error("Confirmed counts do not cover this packet date");
    if (extras.includes("summary")) pages.push(wrap("SR-03", index, renderSR03(menu, index, counts), opts.preview));
    if (extras.includes("prep")) pages.push(wrap("SR-04", index, renderSR04(menu, index), opts.preview));
    pages.push(wrap("SR-05", index, renderSR05(menu, index, counts), opts.preview));
    pages.push(wrap("SR-06", index, renderSR06(menu, index, counts), opts.preview));
    pages.push(wrap("SR-07", index, renderSR07(menu, index, extras.includes("dessert"), counts), opts.preview));
    if (extras.includes("dessert")) pages.push(wrap("SR-08", index, renderSR08(menu, index), opts.preview));
  };
  if (selection.kind === "weekly") {
    weekly();
  } else if (selection.kind === "daily") {
    const index = menu.days.findIndex(day => day.date.value === selection.date);
    if (index < 0) throw new Error(`Daily packet date must match a date in the verified menu: ${selection.date}`);
    const extras = selection.extras ?? [];
    if (new Set(extras).size !== extras.length || extras.some(extra => !["summary", "prep", "dessert"].includes(extra))) {
      throw new Error("Daily extras must be unique values: summary, prep, dessert");
    }
    daily(index, extras);
  } else if (selection.kind === "complete") {
    weekly();
    for (let index = 0; index < 7; index++) daily(index, ["summary", "prep", "dessert"]);
  } else {
    throw new Error("Packet must be weekly, daily or complete");
  }
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(resolved?.area.name ?? facilityHeading(menu))} - Week ${menu.week} - ${selection.kind}${opts.preview ? " - REVIEW" : ""}</title>
<style>${SHARED_CSS}</style></head><body><div class="packet" data-packet="${selection.kind}">
${pages.join("\n")}
</div></body></html>`;
}

export function countPacketPages(html: string): number {
  const m = html.match(/<div class="page"/g);
  return m ? m.length : 0;
}

export function checkNoExternalRefs(html: string): void {
  const lower = html.toLowerCase();
  if (lower.includes("<script")) {
    throw new Error("packet HTML must not contain scripts");
  }
  const banned = ["http://", "https://", "@import", "url(http", "src=\"http", "href=\"http", "//fonts."];
  for (const b of banned) {
    if (lower.includes(b)) {
      throw new Error(`packet HTML must not contain external reference: ${b}`);
    }
  }
}

export type OverflowInfo = {
  index: number;
  sheet: string;
  scrollH: number;
  clientH: number;
  scrollW: number;
  clientW: number;
};

export async function renderPdfFromHtml(html: string, pdfPath: string): Promise<void> {
  const n = countPacketPages(html);
  if (n < 1 || n > EXPECTED_PAGES) {
    throw new Error(`packet must contain 1 to ${EXPECTED_PAGES} selected pages, found ${n}`);
  }
  checkNoExternalRefs(html);

  await fs.mkdir(path.dirname(pdfPath), { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const overflows = (await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".page"));
      return els.map((el, index) => {
        const e = el as HTMLElement;
        return {
          index,
          sheet: e.getAttribute("data-sheet") ?? "",
          scrollH: e.scrollHeight,
          clientH: e.clientHeight,
          scrollW: e.scrollWidth,
          clientW: e.clientWidth,
        };
      });
    })) as OverflowInfo[];
    const bad = overflows.filter(
      (o) => o.scrollH > o.clientH + 1 || o.scrollW > o.clientW + 1
    );
    if (bad.length > 0) {
      const details = bad
        .map(
          (o) =>
            `page ${o.index + 1} (${o.sheet}): scroll ${o.scrollW}x${o.scrollH} exceeds box ${o.clientW}x${o.clientH}`
        )
        .join("; ");
      throw new Error(`rendering overflow: content exceeds fixed print box: ${details}`);
    }
    const layoutIssues = await page.evaluate(() => {
      const errors: string[] = [];
      document.querySelectorAll<HTMLElement>(".page").forEach((sheet, index) => {
        const bounds = sheet.getBoundingClientRect();
        sheet.querySelectorAll<HTMLElement>("*").forEach(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (style.display === "none" || rect.width === 0 || rect.height === 0) return;
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) {
            errors.push(`page ${index + 1}: ${element.tagName}.${element.className} outside print box`);
          }
          if (element.childNodes.length && Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
            if (parseFloat(style.fontSize) < 13.3) errors.push(`page ${index + 1}: text below 10pt`);
          }
        });
      });
      return errors;
    });
    if (layoutIssues.length) throw new Error(`rendering layout failure: ${layoutIssues.slice(0, 12).join("; ")}`);
    const temporaryPdf = `${pdfPath}.tmp-${process.pid}`;
    try {
    await page.pdf({
      path: temporaryPdf,
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0.4in", bottom: "0.4in", left: "0.4in", right: "0.4in" },
    });
    const renderedPages = await countPdfPages(temporaryPdf);
    if (renderedPages !== n) throw new Error(`PDF must have exactly ${n} selected pages, found ${renderedPages}`);
    await fs.rename(temporaryPdf, pdfPath);
    } finally {
      await fs.rm(temporaryPdf, { force: true });
    }
  } finally {
    await browser.close();
  }

  const pdfPages = await countPdfPages(pdfPath);
  if (pdfPages !== n) {
    throw new Error(`PDF must have exactly ${n} selected pages, found ${pdfPages}`);
  }
}

export async function countPdfPages(pdfPath: string): Promise<number> {
  const buf = await fs.readFile(pdfPath);
  const text = buf.toString("latin1");
  const m = text.match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 0;
}

export async function renderPreview(
  menu: Menu,
  menuDir: string,
  pdfPath: string,
  htmlPath: string,
  selection: PacketSelection = DEFAULT_PACKET,
  scope?: CampusScope
): Promise<void> {
  await verifySource(menu, menuDir);
  const html = buildPacketHtml(menu, { preview: true, selection, ...(scope ? {scope} : {}) });
  if (!html.includes(WATERMARK_TEXT)) {
    throw new Error("preview HTML must be watermarked");
  }
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await fs.writeFile(htmlPath, html, "utf8");
  await renderPdfFromHtml(html, pdfPath);
}

export async function renderProduction(
  menu: Menu,
  menuDir: string,
  pdfPath: string,
  selection: PacketSelection = DEFAULT_PACKET,
  scope?: CampusScope
): Promise<void> {
  assertApproved(menu);
  await verifySource(menu, menuDir);
  const html = buildPacketHtml(menu, { preview: false, selection, ...(scope ? {scope} : {}) });
  if (html.includes("REVIEW ONLY")) {
    throw new Error("production HTML must not contain review watermark");
  }
  await renderPdfFromHtml(html, pdfPath);
}

/** A blank meal-production station log is independent of any resident menu or prep rules. */
export function buildWorkAreaHtml(profile: CampusProfile, workAreaId: string, date: string, preview: boolean): string {
  if (!isRealCalendarDate(date)) throw new Error("Work-area date must be a real YYYY-MM-DD date");
  const {area,kitchen} = resolveWorkArea(profile,workAreaId,preview);
  const row = '<tr><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td></tr>';
  const inner = `<div class="sheet-head"><div><p class="facility">${escapeHtml(profile.name)}</p><p class="sheet-title">K-09 - ${escapeHtml(area.name)} Production Log</p><p class="sheet-sub">${escapeHtml(date)}${kitchen ? " - "+escapeHtml(kitchen.name) : ""}</p></div><div class="sheet-meta">Staff initials<br><span class="blank-line">&nbsp;</span></div></div>
    <h3 class="section-heading band-prep">Assigned meal-production work</h3>
    <table class="grid"><colgroup><col><col style="width:0.7in"><col style="width:1in"><col style="width:1.5in"></colgroup><thead><tr><th>Prep / production task</th><th>Initials</th><th>Time</th><th>Notes / follow-up</th></tr></thead><tbody>${row.repeat(12)}</tbody></table>
    <div class="footer"><div class="label band-specials">Handover / unresolved work</div><div class="blank blank-tall">&nbsp;</div><div class="write-row"><div class="write-cell">Outgoing initials <span class="blank-line">&nbsp;</span></div><div class="write-cell">Receiving initials <span class="blank-line">&nbsp;</span></div></div></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(area.name)} - ${escapeHtml(date)}</title><style>${SHARED_CSS}</style></head><body><div class="packet">${wrapPage("K-09",null,inner,preview)}</div></body></html>`;
}
export async function renderWorkArea(profile:CampusProfile,workAreaId:string,date:string,preview:boolean,pdfPath:string): Promise<void> {
  await renderPdfFromHtml(buildWorkAreaHtml(profile,workAreaId,date,preview),pdfPath);
}

export function buildRossWorksheetHtml(profile:CampusProfile,areaId:string,date:string,kind:RossWorksheet,preview:boolean):string {
  if(!isRealCalendarDate(date))throw new Error('Worksheet date must be a real YYYY-MM-DD date');
  const area=profile.residentAreas.find(area=>area.id===areaId&&area.active);
  if(!area)throw new Error('Unknown or inactive resident area');
  if(!preview&&profile.status!=='confirmed'&&!profile.residentAreasConfirmedBy)throw new Error('Confirm the resident-area names first');
  const code=kind==='prep-list'?'RM-10':'RM-11';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${code} - ${escapeHtml(area.name)}</title><style>${SHARED_CSS}</style></head><body><div class="packet">${wrapPage(code,null,renderRossWorksheet(kind,area.name,date,profile.residentAreas.filter(a=>a.active).length===3&&['ross_manor','sylvia_ross','engel_place'].every(id=>profile.residentAreas.some(a=>a.active&&a.id===id))),preview)}</div></body></html>`;
}
export async function renderRossWorksheetPdf(profile:CampusProfile,areaId:string,date:string,kind:RossWorksheet,preview:boolean,pdfPath:string):Promise<void>{
  await renderPdfFromHtml(buildRossWorksheetHtml(profile,areaId,date,kind,preview),pdfPath);
}
