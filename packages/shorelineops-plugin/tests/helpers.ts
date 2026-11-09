import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Day, Field, ItemKind, Menu, Option } from "../src/schema/index.js";

export const SYNTHETIC_SOURCE_REL = "tests/fixtures/synthetic-source.txt";

export function syntheticSourceSha256(): string {
  const abs = path.resolve(process.cwd(), SYNTHETIC_SOURCE_REL);
  const bytes = readFileSync(abs);
  return createHash("sha256").update(bytes).digest("hex");
}

export function field(
  originalText: string,
  value: string,
  cell: string,
  opts: { confidence?: number | null; needsReview?: boolean; file?: string } = {}
): Field {
  return {
    originalText,
    value,
    confidence: opts.confidence ?? null,
    source: { file: opts.file ?? SYNTHETIC_SOURCE_REL, cell },
    needsReview: opts.needsReview ?? false,
  };
}

export function textField(text: string, cell: string): Field {
  return field(text, text, cell);
}

export type Part = { text: string; kind?: ItemKind };

export function makeOption(fullParts: Part[], cellPrefix: string): Option {
  const fullText = fullParts.map((p) => p.text).join(", ");
  return {
    text: textField(fullText, `${cellPrefix}-opt`),
    items: fullParts.map((p, i) => ({
      text: textField(p.text, `${cellPrefix}-i${i}`),
      kind: p.kind ?? "unspecified",
    })),
  };
}

const DATES = [
  "2026-10-25",
  "2026-10-26",
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
  "2026-10-31",
];

function makeDay(dateYmd: string, di: number): Day {
  const c = `d${di}`;
  const escapeBreakfastB: Part[] =
    di === 0
      ? [{ text: `Eggs & Toast` }, { text: `Milk <2%>` }]
      : [{ text: "Oatmeal" }, { text: "Milk" }];
  return {
    date: field(dateYmd, dateYmd, `${c}-date`),
    meals: {
      breakfast: {
        a: makeOption([{ text: "Oatmeal" }, { text: "Milk" }, { text: "Fruit Cup" }], `${c}-bf-a`),
        b: makeOption(escapeBreakfastB, `${c}-bf-b`),
      },
      lunch: {
        a: makeOption(
          [{ text: "Chicken Soup" }, { text: "Crackers" }, { text: "Pudding Cup", kind: "dessert" }],
          `${c}-lu-a`
        ),
        b: makeOption([{ text: "Tuna Salad" }, { text: "Chips" }], `${c}-lu-b`),
      },
      dinner: {
        a: makeOption(
          [{ text: "Beef Stew" }, { text: "Roll" }, { text: "Cookie", kind: "dessert" }],
          `${c}-di-a`
        ),
        b: makeOption([{ text: "Pasta" }, { text: "Green Beans" }], `${c}-di-b`),
      },
    },
  };
}

export function makeValidMenu(opts: { sourceFile?: string; sha256?: string } = {}): Menu {
  const sourceFile = opts.sourceFile ?? SYNTHETIC_SOURCE_REL;
  const sha256 = opts.sha256 ?? syntheticSourceSha256();
  return {
    schemaVersion: 1,
    facility: "sylvia_ross",
    week: 1,
    startDate: DATES[0]!,
    source: { file: sourceFile, sha256 },
    metadata: {
      week: field("Week 1", "1", "meta-week"),
      startDate: field(DATES[0]!, DATES[0]!, "meta-date"),
    },
    days: DATES.map((d, i) => makeDay(d, i)),
    approval: null,
  };
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
