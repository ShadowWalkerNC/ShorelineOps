import type { DayCounts } from "../production/scans.js";
import type { Menu } from "../schema/index.js";
import { renderMealService } from "./meal-service.js";
export function renderSR06(menu: Menu, dayIndex: number, counts?: DayCounts): string {
  return renderMealService(menu, dayIndex, "lunch", "SR-06", "Lunch Cook Sheet", true, counts);
}
