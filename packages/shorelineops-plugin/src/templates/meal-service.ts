import type { DayCounts } from "../production/scans.js";
import type { Menu, Option } from "../schema/index.js";
import { facilityHeading, escapeHtml, dayName, displayFood } from "./html.js";
export function renderMealService(menu: Menu, dayIndex: number, mealName: "breakfast" | "lunch" | "dinner", code: string, title: string, dessertSheetIssued = true, counts?: DayCounts): string {
  const day = menu.days[dayIndex];
  if (!day) throw new Error(`${code}: missing day ${dayIndex}`);
  const meal = day.meals[mealName];
  const option = (label: "A" | "B", data: Option) => `
    <section class="cook-option">
      <h3 class="meal-${mealName}">Option ${label}<span class="option-count">Count <span class="blank-line">${counts ? counts[mealName][label === "A" ? "a" : "b"] : "&nbsp;"}</span></span></h3>
      <p class="option-description">${escapeHtml(displayFood(data.text.value))}</p>
      <table class="grid" aria-label="Option ${label} items">
        <colgroup><col><col style="width:0.7in"><col style="width:0.85in"><col style="width:1in"></colgroup>
        <thead><tr><th>Item in order</th><th>Qty</th><th>Cook initials</th><th>Time finished</th></tr></thead>
        <tbody>${data.items.map(item => `<tr><td>${escapeHtml(displayFood(item.text.value))}</td><td><span class="count-box">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td><td><span class="blank">&nbsp;</span></td></tr>`).join("")}</tbody>
      </table>
    </section>`;
  return `<div class="sheet-head"><div><p class="facility">${escapeHtml(facilityHeading(menu))}</p><p class="sheet-title">${code} - ${title}</p><p class="sheet-sub">${dayName(dayIndex)} - ${escapeHtml(day.date.value)} - Week ${menu.week}</p></div><div class="sheet-meta">Cook initials <span class="blank-line">&nbsp;</span><br>Time <span class="blank-line">&nbsp;</span></div></div>
  ${option("A", meal.a)}${option("B", meal.b)}
  ${mealName === "dinner" ? `<p class="responsibility band-dessert">${dessertSheetIssued ? 'PM dessert / cold prep: use the same-day SR-08. Record completion initials and time there.' : 'Dessert components: record initials and time in the item rows above. A separate SR-08 worksheet is optional.'}</p>` : ''}
  <div class="footer"><div class="label band-specials">Specials / Notes</div><div class="blank blank-tall">&nbsp;</div></div>`;
}
