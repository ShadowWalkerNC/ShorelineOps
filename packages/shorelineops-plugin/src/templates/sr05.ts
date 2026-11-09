import type { DayCounts } from "../production/scans.js";
import type { Menu } from "../schema/index.js";
import { renderMealService } from "./meal-service.js";
export function renderSR05(menu: Menu, dayIndex: number, counts?: DayCounts): string {
  return renderMealService(menu, dayIndex, "breakfast", "SR-05", "AM/Breakfast Cook Sheet", true, counts);
}
