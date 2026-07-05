// ============================================================
// TYPES — BARREL EXPORT
// ============================================================
export type { UserRole, Department, Permission } from './roles'
export { ROLE_RANK, ROLE_LABEL, ROLE_PERMISSIONS, DEPARTMENTS, USER_ROLES, hasPermission, roleAtLeast } from './roles'

export type { StaffProfile, StaffStatus, CallOut, CallOutReason, CallOutShift, Certification, EmergencyContact, ScheduleEntry, TimecardPunch } from './staff'
export { COMMON_CERTIFICATIONS } from './staff'

export type { InventoryItem, InventoryCategory, InventoryUnit, StorageLocation, PriceRecord, InventoryCount, InventoryCountStatus, InventoryCountItem, TruckOrder, TruckOrderStatus, TruckOrderItem, VendorContact, LocationSettings } from './inventory'
export { INVENTORY_CATEGORIES, INVENTORY_UNITS, STORAGE_LOCATIONS } from './inventory'

export type { BudgetPeriod, MealCostBreakdown, DayMenuCostEstimate, MenuMealCost, MenuCostLineItem, PriceAlert } from './budget'

export type { Notification, NotificationType, NotificationLinkType, CommunicationThread, ThreadType, ThreadStatus, ThreadEntry, ApprovalRequest, ApprovalType, ApprovalStatus } from './communications'

export type { ChecklistTemplate, ChecklistTemplateItem, ChecklistShift, ChecklistRole, ChecklistFrequency, CompletedChecklist, CompletedChecklistItem } from './checklist'
export { CHECKLIST_EDIT_MIN_ROLE } from './checklist'

export type { PrepListTemplate, PrepListSection, PrepListTemplateItem, PrepListMeal, PrepListInstance, PrepListInstanceSection, PrepListInstanceItem } from './preplist'

// ── Menu ──────────────────────────────────────────────────────────────────────
export type { MealSlot, MealGroup, DayOfWeek, ItemMealCategory, DietaryTag, MenuItem, MealEntry, DayMenu, MenuWeek } from './menu'
export { MEAL_SLOTS, MEAL_SLOT_LABELS, MEAL_GROUPS, DAYS_OF_WEEK, ITEM_MEAL_CATEGORIES, DIETARY_TAGS, emptyDayMenu, emptyWeek } from './menu'

// ── Residents ─────────────────────────────────────────────────────────────────
export type { ResidentStatus, Texture, PortionSize, ServingLocation, DietType, Allergy, Beverage, Resident } from './resident'
export { DIET_TYPES, ALLERGY_OPTIONS, BEVERAGE_OPTIONS, MONTHS } from './resident'

// ── Production ────────────────────────────────────────────────────────────────
export type { ProductionRow, MealCount, ProductionSheet } from './production'
export { TEXTURE_LIST, DIET_LIST, LOCATION_LIST, emptyMealCount } from './production'

// ── Compliance ────────────────────────────────────────────────────────────────
export type { FacilityInfo, HipaaOfficer, BaaAcknowledgment, RiskAssessment, WorkforceAcknowledgment, BreachSeverity, BreachStatus, BreachIncident, ComplianceStatusColor, ComplianceStatusItem, ComplianceRecord } from './compliance'
