import type { Menu } from "../schema/index.js";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function dayName(index: number): string {
  return DAY_NAMES[index] ?? `Day ${index + 1}`;
}

export function dayDate(menu: Menu, index: number): string {
  const d = menu.days[index];
  return d ? d.date.value : "";
}

export function weekRange(menu: Menu): string {
  const first = menu.days[0]?.date.value ?? menu.startDate;
  const last = menu.days[menu.days.length - 1]?.date.value ?? "";
  return `${first} - ${last}`;
}

/** Display-only casing; canonical source text remains unchanged. */
export function displayFood(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const sentence = text.toLowerCase().replace(/^[a-z]/, char => char.toUpperCase());
  return sentence.replace(/\bblt\b/g, "BLT");
}

export function facilityHeading(menu: Menu): string {
  return menu.metadata.facility?.value ?? (menu.facility === "sylvia_ross" ? "Sylvia Ross Home" : menu.facility);
}
