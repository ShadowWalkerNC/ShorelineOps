import type { Menu } from "../schema/index.js";
import { facilityHeading, escapeHtml, dayName, displayFood } from "./html.js";

type DessertRow = { text: string; from: string };

export function dessertsForDay(menu: Menu, dayIndex: number): DessertRow[] {
  const day = menu.days[dayIndex];
  if (!day) return [];
  const out: DessertRow[] = [];
  const meals: { name: string; label: string }[] = [
    { name: "breakfast", label: "Breakfast" },
    { name: "lunch", label: "Lunch" },
    { name: "dinner", label: "Dinner" },
  ];
  for (const m of meals) {
    const meal = day.meals[m.name as "breakfast" | "lunch" | "dinner"];
    for (const opt of ["a", "b"] as const) {
      const option = meal[opt];
      const from = `${m.label} ${opt.toUpperCase()}`;
      for (const item of option.items) {
        if (item.kind === "dessert") {
          out.push({ text: item.text.value, from });
        }
      }
    }
  }
  return out;
}

export function renderSR08(menu: Menu, dayIndex: number): string {
  const day = menu.days[dayIndex];
  if (!day) throw new Error(`SR-08: missing day ${dayIndex}`);
  const title = `${dayName(dayIndex)} · ${day.date.value}`;
  const desserts = dessertsForDay(menu, dayIndex);

  const dessertRows = desserts.length ? desserts.map(d => `<tr><td>${escapeHtml(displayFood(d.text))}</td><td>${escapeHtml(d.from)}</td><td><span class="count-box">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td></tr>`).join('') : '<tr><td colspan="5">No desserts classified for this day.</td></tr>';
  const taskRow = '<tr><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td></tr>';
  const tasks = (label: string, count: number) => `<h3 class="section-heading band-dessert">${label}</h3><table class="grid" aria-label="${label}"><colgroup><col><col style="width:0.6in"><col style="width:0.8in"><col style="width:1in"></colgroup><thead><tr><th>Task</th><th>Qty</th><th>Initials</th><th>Time finished</th></tr></thead><tbody>${taskRow.repeat(count)}</tbody></table>`;
  return `<div class="sheet-head"><div><p class="facility">${escapeHtml(facilityHeading(menu))}</p><p class="sheet-title">SR-08 - Dessert &amp; Cold Prep</p><p class="sheet-sub">${dayName(dayIndex)} - ${escapeHtml(day.date.value)} - Week ${menu.week}</p></div><div class="sheet-meta">PM prep initials<br><span class="blank-line">&nbsp;</span></div></div>
  <h3 class="section-heading band-dessert">Desserts for this day</h3><table class="grid" aria-label="Desserts"><colgroup><col><col style="width:1in"><col style="width:0.5in"><col style="width:0.7in"><col style="width:1in"></colgroup><thead><tr><th>Dessert</th><th>From</th><th>Qty</th><th>Initials</th><th>Time finished</th></tr></thead><tbody>${dessertRows}</tbody></table>
  <div class="write-row" style="margin:0.08in 0"><div class="write-cell">Completion time <span class="blank-line">&nbsp;</span></div><div class="write-cell">Initials <span class="blank-line">&nbsp;</span></div></div>
  ${tasks('Cold prep',4)}<div style="height:0.1in"></div>${tasks('Future prep',3)}
  <div class="footer"><div class="label band-specials">Specials / Notes</div><div class="blank blank-tall">&nbsp;</div></div>`;
}
