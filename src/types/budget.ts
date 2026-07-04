// ============================================================
// BUDGET & COST TRACKING
// ============================================================
// Tracks spending against the per-resident-per-day budget.
// Costs flow in from: truck order receipts → budget period.
// Menu planning checks projected cost vs. budget before finalizing.
// ============================================================

// ── Budget Period (monthly) ───────────────────────────────────────────────────
export interface BudgetPeriod {
  id: string
  /** YYYY-MM */
  month: string
  /** USD per resident per day for this period */
  budgetPerResidentPerDay: number
  /** Average daily census for the month */
  avgCensus: number
  /** Number of days in the month */
  daysInMonth: number
  /**
   * Total budget = budgetPerResidentPerDay × avgCensus × daysInMonth
   * Derived — do not store redundantly; compute at read time.
   */
  totalBudget: number
  /** Sum of all received truck order line totals for the month */
  totalSpent: number
  /** totalBudget - totalSpent — negative = over budget */
  variance: number
  mealCostBreakdown: MealCostBreakdown
  createdAt: string
  updatedAt: string
}

export interface MealCostBreakdown {
  /** Estimated cost per resident per meal */
  breakfastPerResident: number
  lunchPerResident: number
  dinnerPerResident: number
  snacksPerResident: number
}

// ── Meal Cost Estimate ────────────────────────────────────────────────────────
/**
 * Projected cost for a single day's menu.
 * Built from: recipe ingredients → inventory unit costs → census.
 */
export interface DayMenuCostEstimate {
  date: string              // YYYY-MM-DD
  census: number
  breakfast: MenuMealCost
  lunch: MenuMealCost
  dinner: MenuMealCost
  /** Total estimated food cost for the day */
  totalEstimatedCost: number
  /** totalEstimatedCost / census */
  costPerResident: number
  /** budgetPerResidentPerDay × census */
  budgetForDay: number
  /** budgetForDay - totalEstimatedCost */
  budgetVariance: number
}

export interface MenuMealCost {
  /** Ingredient-level cost breakdown */
  items: MenuCostLineItem[]
  totalCost: number
  costPerResident: number
}

export interface MenuCostLineItem {
  ingredientName: string
  inventoryItemId?: string  // linked inventory item if matched
  qty: number
  unit: string
  unitCost: number
  lineTotal: number
}

// ── Price Alert ───────────────────────────────────────────────────────────────
/** Generated when a truck delivery records a price higher than the last order */
export interface PriceAlert {
  id: string
  inventoryItemId: string
  itemName: string
  previousUnitCost: number
  newUnitCost: number
  /** Percentage change */
  changePercent: number
  detectedAt: string
  acknowledgedById?: string
  acknowledgedAt?: string
}
