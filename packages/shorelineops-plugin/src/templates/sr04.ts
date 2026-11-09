import type { Menu } from "../schema/index.js";
import { facilityHeading, escapeHtml, dayName } from "./html.js";
export function renderSR04(menu: Menu, dayIndex: number): string {
  const day = menu.days[dayIndex];
  if (!day) throw new Error(`SR-04: missing day ${dayIndex}`);
  const rows = (count: number, columns: number) => Array.from({length:count}, () => `<tr>${'<td><span class="blank">&nbsp;</span></td>'.repeat(columns)}</tr>`).join('');
  const prep = (meal: string) => `<section><h3 class="meal-${meal.toLowerCase()}">${meal} prep</h3><table class="grid"><colgroup><col><col style="width:0.45in"><col style="width:0.6in"></colgroup><thead><tr><th>Item</th><th>Qty</th><th>Initials</th></tr></thead><tbody>${rows(5,3)}</tbody></table></section>`;
  return `<div class="sheet-head"><div><p class="facility">${escapeHtml(facilityHeading(menu))}</p><p class="sheet-title">SR-04 - Daily Prep Cook List</p><p class="sheet-sub">${dayName(dayIndex)} - ${escapeHtml(day.date.value)} - Week ${menu.week}</p></div><div class="sheet-meta">Prep cook initials<br><span class="blank-line">&nbsp;</span></div></div>
  <h3 class="section-heading band-prep">Pull list - kitchen assigns timing and quantities</h3><table class="grid"><colgroup><col><col style="width:0.55in"><col style="width:1.7in"><col style="width:1.1in"><col style="width:0.7in"></colgroup><thead><tr><th>Item to pull</th><th>Qty</th><th>Needed for: date / meal</th><th>Pull date</th><th>Initials</th></tr></thead><tbody>${rows(4,5)}</tbody></table>
  <div class="prep-columns">${prep('Breakfast')}${prep('Lunch')}${prep('Dinner')}</div>
  <h3 class="section-heading band-prep">Extra prep</h3><table class="grid"><colgroup><col><col style="width:0.8in"><col style="width:1in"></colgroup><thead><tr><th>Item</th><th>Qty</th><th>Initials</th></tr></thead><tbody>${rows(3,3)}</tbody></table>
  <div class="footer"><div class="label band-specials">Shortages / Notes</div><div class="blank blank-tall">&nbsp;</div><div class="write-row"><div class="write-cell">Initials <span class="blank-line">&nbsp;</span></div><div class="write-cell">Date <span class="blank-line">&nbsp;</span></div></div></div>`;
}
