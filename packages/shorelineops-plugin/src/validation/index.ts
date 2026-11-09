import { createHash } from "node:crypto";
import { MenuSchema, type Menu, type Field } from "../schema/index.js";

export type ValidateOk = { ok: true; menu: Menu };
export type ValidateErr = { ok: false; errors: string[] };
export type ValidateResult = ValidateOk | ValidateErr;

const LAYOUT_BASENAMES = new Set([
  "resident-tally-preview.jpg",
  "workflow-preview.jpg",
]);

function basenameOf(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? p;
}

function isLayoutReference(file: string): boolean {
  const lower = file.toLowerCase();
  if (lower.includes("references")) return true;
  if (lower.includes("resident-tally")) return true;
  if (lower.includes("workflow-preview")) return true;
  const base = basenameOf(file).toLowerCase();
  if (LAYOUT_BASENAMES.has(base)) return true;
  return false;
}

export function normalizeMenuText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isRealCalendarDate(ymd: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

function addDaysYmd(ymd: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + n);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function weekdayUtc(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return -1;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

export function listUnresolvedFields(menu: Menu): string[] {
  const out: string[] = [];
  const check = (f: Field, path: string) => {
    if (f.needsReview) out.push(path);
  };
  if (menu.metadata.facility) check(menu.metadata.facility, "metadata.facility");
  check(menu.metadata.week, "metadata.week");
  check(menu.metadata.startDate, "metadata.startDate");
  menu.days.forEach((day, di) => {
    check(day.date, `days[${di}].date`);
    (["breakfast", "lunch", "dinner"] as const).forEach((mealName) => {
      const meal = day.meals[mealName];
      (["a", "b"] as const).forEach((optName) => {
        const opt = meal[optName];
        check(opt.text, `days[${di}].meals.${mealName}.${optName}.text`);
        opt.items.forEach((it, ii) => {
          check(it.text, `days[${di}].meals.${mealName}.${optName}.items[${ii}].text`);
        });
      });
    });
  });
  return out;
}

export function countOptions(menu: Menu): number {
  let n = 0;
  for (const d of menu.days) {
    for (const mealName of ["breakfast", "lunch", "dinner"] as const) {
      const meal = d.meals[mealName];
      if (meal.a) n += 1;
      if (meal.b) n += 1;
    }
  }
  return n;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((e) => stableStringify(e)).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
}

export function menuContentHash(menu: Menu): string {
  const { approval: _approval, ...rest } = menu;
  void _approval;
  const canonical = stableStringify(rest);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function collectFieldSources(menu: Menu): { path: string; file: string }[] {
  const out: { path: string; file: string }[] = [];
  if (menu.metadata.facility) out.push({ path: "metadata.facility", file: menu.metadata.facility.source.file });
  out.push({ path: "metadata.week", file: menu.metadata.week.source.file });
  out.push({ path: "metadata.startDate", file: menu.metadata.startDate.source.file });
  menu.days.forEach((day, di) => {
    out.push({ path: `days[${di}].date`, file: day.date.source.file });
    (["breakfast", "lunch", "dinner"] as const).forEach((mealName) => {
      const meal = day.meals[mealName];
      (["a", "b"] as const).forEach((optName) => {
        const opt = meal[optName];
        out.push({
          path: `days[${di}].meals.${mealName}.${optName}.text`,
          file: opt.text.source.file,
        });
        opt.items.forEach((it, ii) => {
          out.push({
            path: `days[${di}].meals.${mealName}.${optName}.items[${ii}].text`,
            file: it.text.source.file,
          });
        });
      });
    });
  });
  return out;
}

function isNonemptyTrim(s: string): boolean {
  return s.trim().length > 0;
}

export function validateMenu(input: unknown): ValidateResult {
  const parsed = MenuSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => {
      const path = i.path.length > 0 ? i.path.join(".") : "(root)";
      return `${path}: ${i.message}`;
    });
    return { ok: false, errors };
  }
  const menu = parsed.data;
  const errors: string[] = [];

  if (isLayoutReference(menu.source.file)) {
    errors.push(`source.file: layout/reference files must never be used as source`);
  }

  for (const { path, file } of collectFieldSources(menu)) {
    if (file !== menu.source.file) {
      errors.push(`${path}.source.file: must agree with source.file (${menu.source.file})`);
    }
    if (isLayoutReference(file)) {
      errors.push(`${path}.source.file: layout/reference files must never be used as source`);
    }
  }

  const checkFieldText = (f: Field, path: string) => {
    if (!isNonemptyTrim(f.originalText)) errors.push(`${path}.originalText: must be nonempty`);
    if (!isNonemptyTrim(f.value)) errors.push(`${path}.value: must be nonempty`);
    if (!isNonemptyTrim(f.source.cell)) errors.push(`${path}.source.cell: must be nonempty`);
  };
  if (menu.metadata.facility) checkFieldText(menu.metadata.facility, "metadata.facility");
  else if (menu.facility !== "sylvia_ross") errors.push("metadata.facility: source evidence is required for a new resident area");
  checkFieldText(menu.metadata.week, "metadata.week");
  checkFieldText(menu.metadata.startDate, "metadata.startDate");
  if (menu.metadata.week.value !== String(menu.week)) {
    errors.push(`metadata.week.value: must equal week (${menu.week})`);
  }
  if (menu.metadata.startDate.value !== menu.startDate) {
    errors.push(`metadata.startDate.value: must equal startDate (${menu.startDate})`);
  }

  if (!isRealCalendarDate(menu.startDate)) {
    errors.push(`startDate: not a real calendar date`);
  }

  if (menu.days.length !== 7) {
    errors.push(`days: must contain exactly 7 entries`);
  } else {
    const values = menu.days.map((d) => d.date.value);
    values.forEach((v, i) => {
      checkFieldText(menu.days[i]!.date, `days[${i}].date`);
      if (!isRealCalendarDate(v)) errors.push(`days[${i}].date.value: not a real calendar date`);
    });
    if (values.every(isRealCalendarDate)) {
      if (menu.startDate !== values[0]) {
        errors.push(`startDate: must equal days[0].date.value (${values[0]})`);
      }
      for (let i = 1; i < 7; i++) {
        const expected = addDaysYmd(values[0]!, i);
        if (values[i] !== expected) {
          errors.push(`days[${i}].date.value: must be consecutive (${expected})`);
        }
      }
      if (weekdayUtc(values[0]!) !== 0) {
        errors.push(`days[0].date.value: week must start Sunday`);
      }
      if (weekdayUtc(values[6]!) !== 6) {
        errors.push(`days[6].date.value: week must end Saturday`);
      }
    }
  }

  const nOptions = countOptions(menu);
  if (nOptions !== 42) {
    errors.push(`options: must total 42, found ${nOptions}`);
  }

  menu.days.forEach((day, di) => {
    (["breakfast", "lunch", "dinner"] as const).forEach((mealName) => {
      const meal = day.meals[mealName];
      (["a", "b"] as const).forEach((optName) => {
        const opt = meal[optName];
        const base = `days[${di}].meals.${mealName}.${optName}`;
        checkFieldText(opt.text, `${base}.text`);
        if (opt.items.length < 1) {
          errors.push(`${base}.items: must have at least one item`);
        }
        opt.items.forEach((it, ii) => {
          checkFieldText(it.text, `${base}.items[${ii}].text`);
        });
        const optNorm = normalizeMenuText(opt.text.value);
        const itemsNorm = normalizeMenuText(opt.items.map((it) => it.text.value).join(""));
        if (optNorm.length === 0) {
          errors.push(`${base}.text.value: normalizes to empty`);
        } else if (optNorm !== itemsNorm) {
          errors.push(
            `${base}: option text and ordered item text must agree ignoring case/whitespace/punctuation`
          );
        }
        const optOrigNorm = normalizeMenuText(opt.text.originalText);
        const itemsOrigNorm = normalizeMenuText(
          opt.items.map((it) => it.text.originalText).join("")
        );
        if (optOrigNorm.length === 0) {
          errors.push(`${base}.text.originalText: normalizes to empty`);
        } else if (optOrigNorm !== itemsOrigNorm) {
          errors.push(
            `${base}: option originalText and ordered item originalText must agree ignoring case/whitespace/punctuation`
          );
        }
      });
    });
  });

  if (menu.approval !== null) {
    if (!isNonemptyTrim(menu.approval.reviewer)) {
      errors.push(`approval.reviewer: must be nonempty`);
    }
    const t = Date.parse(menu.approval.approvedAt);
    if (Number.isNaN(t)) {
      errors.push(`approval.approvedAt: must be a parseable timestamp`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, menu };
}

export function assertApproved(menu: Menu): void {
  const v = validateMenu(menu);
  if (!v.ok) {
    throw new Error(`menu is invalid: ${v.errors.join("; ")}`);
  }
  const unresolved = listUnresolvedFields(v.menu);
  if (unresolved.length > 0) {
    throw new Error(
      `menu has ${unresolved.length} unresolved field(s): ${unresolved.slice(0, 5).join(", ")}${unresolved.length > 5 ? "…" : ""}`
    );
  }
  const approval = v.menu.approval;
  if (approval === null) {
    throw new Error("menu approval is missing");
  }
  const current = menuContentHash(v.menu);
  if (approval.menuHash.toLowerCase() !== current.toLowerCase()) {
    throw new Error("menu approval is stale (menuHash does not match current revision)");
  }
}
