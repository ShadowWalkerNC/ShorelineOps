import type { Menu } from "../schema/index.js";
import { facilityHeading, escapeHtml, dayName, weekRange, displayFood } from "./html.js";
export function renderSR01(menu: Menu): string {
  const rows = menu.days.map((day, index) => {
    const cell = (name: "breakfast" | "lunch" | "dinner") => (["a", "b"] as const).map(key => `<div class="opt-block"><span class="circle">${key.toUpperCase()}</span><span class="opt-text">${escapeHtml(displayFood(day.meals[name][key].text.value))}</span></div>`).join("");
    return `<tr><td class="day-cell">${dayName(index).slice(0,3)}<br>${escapeHtml(day.date.value.slice(5).replace("-", "/"))}</td><td>${cell("breakfast")}</td><td>${cell("lunch")}</td><td>${cell("dinner")}</td></tr>`;
  }).join("");
  return `<div class="sheet-head"><div><p class="facility">${escapeHtml(facilityHeading(menu))}</p><p class="sheet-title">SR-01 - Weekly Resident Meal Selection</p><p class="sheet-sub">Week ${menu.week} - ${escapeHtml(weekRange(menu))}</p></div></div>
  <div class="resident-details"><span>Resident name: <span class="blank-line">&nbsp;</span></span><span>Room: <span class="blank-line">&nbsp;</span></span></div>
  <table class="grid resident-menu" aria-label="Weekly menu"><colgroup><col style="width:0.5in"><col><col><col></colgroup><thead><tr><th>Day / date</th><th class="meal-breakfast">Breakfast<br>Circle A or B</th><th class="meal-lunch">Lunch<br>Circle A or B</th><th class="meal-dinner">Dinner<br>Circle A or B</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer resident-footer"><div class="label band-specials">Special requests / Notes</div><div class="blank notes-line">&nbsp;</div><div class="write-row"><div class="write-cell">Caregiver initials <span class="blank-line">&nbsp;</span></div><div class="write-cell">Date <span class="blank-line">&nbsp;</span></div></div></div>`;
}
