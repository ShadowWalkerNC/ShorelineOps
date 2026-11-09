import type { DayCounts } from "../production/scans.js";
import type { Menu } from "../schema/index.js";
import { renderMealService } from "./meal-service.js";
export function renderSR07(menu: Menu, dayIndex: number, dessertSheetIssued = true, counts?: DayCounts): string {
  return renderMealService(menu, dayIndex, "dinner", "SR-07", "PM/Dinner Cook Sheet", dessertSheetIssued, counts);
}
