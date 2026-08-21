export interface ReportingSummary {
  dateRange: { start: string; end: string }
  activeResidents: number
  totalFoodCost: string
  totalResidentDays: number
  costPerResidentDay: string | null
  breakdown?: {
    perishableFoodCost: number
    dryGroceryCost: number
    paperGoodsCost: number
    chemicalSanitationCost: number
  }
  estimatedLaborHours?: number
  estimatedLaborCost?: string
  totalOperatingCost?: string
  totalOperatingCostPerResidentDay?: string | null
  substitutions: number
  allergyFlagCount: number
  specialDietCount: number
  generatedAt: string
}

export interface DailyCostLog {
  id: string
  facility_id?: string
  log_date: string
  resident_count: number
  food_cost: string | number
  cost_per_resident_day?: string | number
  notes?: string
  logged_by_name?: string
  created_at?: string
}

export interface SubstitutionLogEntry {
  id: string
  facility_id?: string
  resident_id?: string
  resident_name?: string
  room?: string
  meal_date: string
  meal_type: string
  original_item: string
  substitute_item: string
  reason?: string
  logged_by_name?: string
  created_at?: string
}

export interface ResidentRiskEntry {
  id: string
  first_name: string
  last_name: string
  room?: string
  diet_order?: string
  texture?: string
  allergies?: string | string[]
  beverages?: string | string[]
  supplements?: string | string[]
}

export interface ProductionVarianceEntry {
  id: string
  date: string
  meal_type?: string
  item_name?: string
  planned: number
  produced: number
  variancePct: string | null
}
