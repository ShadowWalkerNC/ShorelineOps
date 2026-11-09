import type { DayCounts, MealCounts } from "../production/scans.js";
import type { Menu } from "../schema/index.js";
import { facilityHeading, escapeHtml, dayName, displayFood } from "./html.js";

export function renderSR03(menu: Menu, dayIndex: number, counts?: DayCounts): string {
  const day = menu.days[dayIndex];
  if (!day) throw new Error(`SR03: missing day ${dayIndex}`);
  const title = `${dayName(dayIndex)} · ${day.date.value}`;

  const mealBlock = (
    label: string,
    cls: string,
    meal: { a: { text: { value: string } }; b: { text: { value: string } } },
    values?: MealCounts
  ) => {
    const a = escapeHtml(displayFood(meal.a.text.value));
    const b = escapeHtml(displayFood(meal.b.text.value));
    return `
<table class="grid" style="margin-bottom:0.06in" aria-label="${label}">
  <thead><tr><th colspan="2" class="${cls}">${label}</th></tr></thead>
  <tbody>
    <tr><td style="width:50%"><div class="opt-block"><span class="circle">A</span><span class="opt-text">${a}</span></div><div class="label">A count</div><span class="count-box">${values?.a ?? "&nbsp;"}</span></td>
    <td><div class="opt-block"><span class="circle">B</span><span class="opt-text">${b}</span></div><div class="label">B count</div><span class="count-box">${values?.b ?? "&nbsp;"}</span></td></tr>
    <tr><td><div class="label">Staff count</div><span class="count-box">${values?.staff ?? "&nbsp;"}</span></td>
    <td><div class="label">Guest / Extra count</div><span class="count-box">${values?.extra ?? "&nbsp;"}</span></td></tr>
  </tbody>
</table>`;
  };

  return `
<div class="sheet-head"><div><p class="facility">${escapeHtml(facilityHeading(menu))}</p><p class="sheet-title">SR-03 - Daily Production Summary</p><p class="sheet-sub">${dayName(dayIndex)} - ${escapeHtml(day.date.value)} - Week ${menu.week}</p></div><div class="sheet-meta">Staff initials <span class="blank-line">&nbsp;</span></div></div>
${mealBlock("Breakfast", "meal-breakfast", day.meals.breakfast, counts?.breakfast)}
${mealBlock("Lunch", "meal-lunch", day.meals.lunch, counts?.lunch)}
${mealBlock("Dinner", "meal-dinner", day.meals.dinner, counts?.dinner)}
<div class="footer"><div class="label">Notes</div><div class="blank">&nbsp;</div></div>`;
}
