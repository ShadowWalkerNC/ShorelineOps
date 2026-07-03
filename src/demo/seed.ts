/**
 * ============================================================
 * DEMO SEED DATA
 * ============================================================
 * All data used by the demo stores lives here.
 * Nothing talks to a backend — mutations update in-memory
 * copies of these arrays at runtime.
 * ============================================================
 */
import type { Resident } from '@/types/resident'
import type { MenuItem, MenuWeek } from '@/types/menu'
import type { Recipe } from '@/types/recipe'
import type { ProductionSheet } from '@/types/production'
import type { AdminUser, AuditLogEntry, SystemSettings } from '@/types/admin'

// ── Residents ─────────────────────────────────────────────────────────────────
export const SEED_RESIDENTS: Resident[] = [
  { id: 'r1',  name: 'Eleanor Whitfield',  room: '101', status: 'Active',     dietType: 'Regular',       texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 1, allergies: [],          beverages: ['Coffee', 'Juice'],    birthdayMonth: 'March',     birthdayDay: 14, servingLocation: 'Dining Room',    tableAssignment: 'A1', likes: 'Soup, fruit cups',           dislikes: 'Spicy food',      specialInstructions: '' },
  { id: 'r2',  name: 'Harold Minter',      room: '102', status: 'Active',     dietType: 'Diabetic',      texture: 'Regular',       portionSize: 'Small',   ensurePerDay: 2, allergies: ['Nuts'],     beverages: ['Decaf', 'Water Only'],birthdayMonth: 'July',      birthdayDay: 3,  servingLocation: 'Dining Room',    tableAssignment: 'A2', likes: 'Eggs, toast',                dislikes: 'Greasy food',     specialInstructions: 'Check blood sugar before meals' },
  { id: 'r3',  name: 'Dorothy Callahan',   room: '104', status: 'Active',     dietType: 'Cardiac',       texture: 'Cut-Up',        portionSize: 'Regular', ensurePerDay: 1, allergies: ['Dairy'],    beverages: ['Tea', 'Juice'],       birthdayMonth: 'November',  birthdayDay: 22, servingLocation: 'Room',           tableAssignment: '',   likes: 'Oatmeal, bananas',           dislikes: 'Red meat',        specialInstructions: 'Serve in room — mobility issues' },
  { id: 'r4',  name: 'Frank Russo',        room: '105', status: 'Active',     dietType: 'Low Sodium',    texture: 'Regular',       portionSize: 'Large',   ensurePerDay: 0, allergies: [],          beverages: ['Coffee', 'Milk'],     birthdayMonth: 'September', birthdayDay: 8,  servingLocation: 'Dining Room',    tableAssignment: 'B1', likes: 'Pasta, bread',               dislikes: 'Fish',            specialInstructions: '' },
  { id: 'r5',  name: 'Margaret Tran',      room: '106', status: 'Active',     dietType: 'Renal',         texture: 'Pureed',        portionSize: 'Small',   ensurePerDay: 2, allergies: ['Gluten'],   beverages: ['Water Only'],         birthdayMonth: 'February',  birthdayDay: 17, servingLocation: 'Memory Care',    tableAssignment: 'MC1',likes: 'Applesauce, pudding',        dislikes: 'Strong flavors',  specialInstructions: 'Fluid restriction 1200 ml/day' },
  { id: 'r6',  name: 'Charles Okonkwo',   room: '107', status: 'Active',     dietType: 'Regular',       texture: 'Minced',        portionSize: 'Regular', ensurePerDay: 1, allergies: [],          beverages: ['Coffee', 'Hot Chocolate'], birthdayMonth: 'June',   birthdayDay: 5,  servingLocation: 'Assisted Living',tableAssignment: 'AL2', likes: 'Chicken, rice',             dislikes: 'Salads',          specialInstructions: '' },
  { id: 'r7',  name: 'Beatrice Larson',   room: '109', status: 'Hospital',   dietType: 'Diabetic',      texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 1, allergies: ['Strawberries'], beverages: ['Tea'],            birthdayMonth: 'April',     birthdayDay: 30, servingLocation: 'Dining Room',    tableAssignment: 'B2', likes: 'Salad, yogurt',              dislikes: 'Fried food',      specialInstructions: 'Currently hospitalized' },
  { id: 'r8',  name: 'George Patel',       room: '110', status: 'Active',     dietType: 'Mechanical Soft', texture: 'Minced & Moist', portionSize: 'Regular', ensurePerDay: 2, allergies: ['Seeds'],  beverages: ['Milk', 'Decaf'],      birthdayMonth: 'December',  birthdayDay: 1,  servingLocation: 'Dining Room',    tableAssignment: 'A3', likes: 'Mashed potatoes, gravy',     dislikes: 'Crunchy foods',   specialInstructions: 'Dentures — minced & moist only' },
  { id: 'r9',  name: 'Helen Fitzgerald',  room: '111', status: 'Active',     dietType: 'Regular',       texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 0, allergies: [],          beverages: ['Coffee', 'Juice'],    birthdayMonth: 'August',    birthdayDay: 19, servingLocation: 'Dining Room',    tableAssignment: 'C1', likes: 'Pancakes, sausage',          dislikes: 'Vegetables',      specialInstructions: '' },
  { id: 'r10', name: 'Walter Nguyen',      room: '112', status: 'LOA',        dietType: 'Regular',       texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 0, allergies: [],          beverages: ['Coffee'],             birthdayMonth: 'October',   birthdayDay: 12, servingLocation: 'Dining Room',    tableAssignment: 'C2', likes: 'Burgers, fries',             dislikes: 'Seafood',         specialInstructions: 'On leave until next week' },
  { id: 'r11', name: 'Sylvia Moreau',      room: '114', status: 'Active',     dietType: 'Cardiac',       texture: 'Regular',       portionSize: 'Small',   ensurePerDay: 1, allergies: ['Caffeine'], beverages: ['Decaf', 'Tea'],       birthdayMonth: 'May',       birthdayDay: 25, servingLocation: 'Assisted Living',tableAssignment: 'AL1', likes: 'Fish, steamed veggies',     dislikes: 'Red meat, salt', specialInstructions: 'No added salt' },
  { id: 'r12', name: 'Thomas Kerr',        room: '115', status: 'Active',     dietType: 'Regular',       texture: 'Regular',       portionSize: 'Large',   ensurePerDay: 0, allergies: [],          beverages: ['Coffee', 'Milk'],     birthdayMonth: 'January',   birthdayDay: 9,  servingLocation: 'Dining Room',    tableAssignment: 'B3', likes: 'Steak, potatoes',            dislikes: 'Tofu',            specialInstructions: '' },
]

// ── Menu items ────────────────────────────────────────────────────────────────
export const SEED_MENU_ITEMS: MenuItem[] = [
  { id: 'mi1',  name: 'Scrambled Eggs',         textureModified: true },
  { id: 'mi2',  name: 'Toast with Butter',       textureModified: true },
  { id: 'mi3',  name: 'Oatmeal',                 textureModified: true,  notes: 'Can add brown sugar or cinnamon' },
  { id: 'mi4',  name: 'Pancakes',                textureModified: true },
  { id: 'mi5',  name: 'Orange Juice',            textureModified: false },
  { id: 'mi6',  name: 'Fresh Fruit Cup',         textureModified: false },
  { id: 'mi7',  name: 'Yogurt Parfait',          textureModified: false },
  { id: 'mi8',  name: 'Grilled Chicken Breast',  textureModified: true },
  { id: 'mi9',  name: 'Mashed Potatoes',         textureModified: true },
  { id: 'mi10', name: 'Green Beans',             textureModified: true },
  { id: 'mi11', name: 'Garden Salad',            textureModified: false },
  { id: 'mi12', name: 'Chicken Noodle Soup',     textureModified: true },
  { id: 'mi13', name: 'Dinner Roll',             textureModified: true },
  { id: 'mi14', name: 'Baked Salmon',            textureModified: true },
  { id: 'mi15', name: 'Steamed Broccoli',        textureModified: true },
  { id: 'mi16', name: 'Brown Rice',              textureModified: true },
  { id: 'mi17', name: 'Beef Pot Roast',          textureModified: true },
  { id: 'mi18', name: 'Egg Noodles',             textureModified: true },
  { id: 'mi19', name: 'Applesauce',              textureModified: false },
  { id: 'mi20', name: 'Pudding Cup',             textureModified: false },
  { id: 'mi21', name: 'Graham Crackers',         textureModified: false },
  { id: 'mi22', name: 'String Cheese',           textureModified: false },
  { id: 'mi23', name: 'Apple Slices',            textureModified: false },
  { id: 'mi24', name: 'Peanut Butter Crackers',  textureModified: false, notes: 'Contains nuts' },
]

// ── Menu week ─────────────────────────────────────────────────────────────────
export const SEED_MENU_WEEKS: MenuWeek[] = [
  {
    id: 'wk1',
    name: 'Week A — Summer 2026',
    active: true,
    effectiveFrom: '2026-06-30',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-28T00:00:00Z',
    days: {
      Sunday:    { breakfast: { itemIds: ['mi3','mi2','mi5'] }, morningSnack: { itemIds: ['mi7'] },     lunch: { itemIds: ['mi12','mi11','mi13'] }, afternoonSnack: { itemIds: ['mi19'] },     dinner: { itemIds: ['mi17','mi18','mi15'] } },
      Monday:    { breakfast: { itemIds: ['mi1','mi2','mi6'] }, morningSnack: { itemIds: ['mi21'] },    lunch: { itemIds: ['mi8','mi9','mi10'] },   afternoonSnack: { itemIds: ['mi22'] },     dinner: { itemIds: ['mi14','mi16','mi15'] } },
      Tuesday:   { breakfast: { itemIds: ['mi4','mi5','mi6'] }, morningSnack: { itemIds: ['mi23'] },    lunch: { itemIds: ['mi12','mi13','mi11'] }, afternoonSnack: { itemIds: ['mi20'] },     dinner: { itemIds: ['mi8','mi9','mi10'] } },
      Wednesday: { breakfast: { itemIds: ['mi3','mi1','mi5'] }, morningSnack: { itemIds: ['mi7'] },     lunch: { itemIds: ['mi8','mi16','mi15'] },  afternoonSnack: { itemIds: ['mi19'] },     dinner: { itemIds: ['mi17','mi18','mi10'] } },
      Thursday:  { breakfast: { itemIds: ['mi1','mi4','mi6'] }, morningSnack: { itemIds: ['mi24'] },    lunch: { itemIds: ['mi14','mi9','mi11'] },  afternoonSnack: { itemIds: ['mi21'] },     dinner: { itemIds: ['mi8','mi16','mi15'] } },
      Friday:    { breakfast: { itemIds: ['mi3','mi2','mi5'] }, morningSnack: { itemIds: ['mi22'] },    lunch: { itemIds: ['mi12','mi13','mi10'] }, afternoonSnack: { itemIds: ['mi20'] },     dinner: { itemIds: ['mi14','mi9','mi15'] } },
      Saturday:  { breakfast: { itemIds: ['mi4','mi6','mi5'] }, morningSnack: { itemIds: ['mi23'] },    lunch: { itemIds: ['mi8','mi9','mi11'] },   afternoonSnack: { itemIds: ['mi19'] },     dinner: { itemIds: ['mi17','mi18','mi10'] } },
    },
  },
  {
    id: 'wk2',
    name: 'Week B — Summer 2026',
    active: false,
    effectiveFrom: '2026-07-07',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-28T00:00:00Z',
    days: {
      Sunday:    { breakfast: { itemIds: ['mi4','mi5','mi7'] }, morningSnack: { itemIds: ['mi23'] },  lunch: { itemIds: ['mi8','mi16','mi11'] },  afternoonSnack: { itemIds: ['mi20'] },  dinner: { itemIds: ['mi14','mi9','mi15'] } },
      Monday:    { breakfast: { itemIds: ['mi1','mi3','mi6'] }, morningSnack: { itemIds: ['mi21'] },  lunch: { itemIds: ['mi17','mi18','mi10'] }, afternoonSnack: { itemIds: ['mi19'] },  dinner: { itemIds: ['mi8','mi9','mi10'] } },
      Tuesday:   { breakfast: { itemIds: ['mi4','mi2','mi5'] }, morningSnack: { itemIds: ['mi22'] },  lunch: { itemIds: ['mi12','mi13','mi11'] }, afternoonSnack: { itemIds: ['mi23'] },  dinner: { itemIds: ['mi17','mi16','mi15'] } },
      Wednesday: { breakfast: { itemIds: ['mi3','mi1','mi6'] }, morningSnack: { itemIds: ['mi7'] },   lunch: { itemIds: ['mi14','mi9','mi10'] },  afternoonSnack: { itemIds: ['mi21'] },  dinner: { itemIds: ['mi8','mi18','mi11'] } },
      Thursday:  { breakfast: { itemIds: ['mi4','mi5','mi6'] }, morningSnack: { itemIds: ['mi24'] },  lunch: { itemIds: ['mi8','mi16','mi15'] },  afternoonSnack: { itemIds: ['mi20'] },  dinner: { itemIds: ['mi14','mi9','mi10'] } },
      Friday:    { breakfast: { itemIds: ['mi1','mi2','mi5'] }, morningSnack: { itemIds: ['mi19'] },  lunch: { itemIds: ['mi17','mi13','mi11'] }, afternoonSnack: { itemIds: ['mi22'] },  dinner: { itemIds: ['mi8','mi16','mi15'] } },
      Saturday:  { breakfast: { itemIds: ['mi3','mi4','mi6'] }, morningSnack: { itemIds: ['mi23'] },  lunch: { itemIds: ['mi12','mi9','mi10'] },  afternoonSnack: { itemIds: ['mi21'] },  dinner: { itemIds: ['mi17','mi18','mi15'] } },
    },
  },
]

// ── Recipes ───────────────────────────────────────────────────────────────────
export const SEED_RECIPES: Recipe[] = [
  {
    id: 'rec1', name: 'Classic Oatmeal', category: 'Breakfast', allergens: ['Gluten'],
    baseServings: 20,
    ingredients: [
      { qty: '10 cups', item: 'rolled oats' },
      { qty: '20 cups', item: 'water' },
      { qty: '1 tsp',   item: 'salt' },
      { qty: '1 cup',   item: 'brown sugar (optional)' },
    ],
    steps: [
      { step: 1, instruction: 'Bring water and salt to a boil.' },
      { step: 2, instruction: 'Stir in oats and reduce heat to medium.' },
      { step: 3, instruction: 'Cook 5 minutes, stirring occasionally.' },
      { step: 4, instruction: 'Serve with brown sugar or cinnamon on the side.' },
    ],
    notes: 'For pureed texture, blend with additional water to desired consistency.',
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'rec2', name: 'Scrambled Eggs', category: 'Breakfast', allergens: ['Eggs', 'Dairy'],
    baseServings: 20,
    ingredients: [
      { qty: '30',      item: 'large eggs' },
      { qty: '1 cup',   item: 'whole milk' },
      { qty: '2 tbsp',  item: 'butter' },
      { qty: '1 tsp',   item: 'salt' },
      { qty: '½ tsp',   item: 'black pepper' },
    ],
    steps: [
      { step: 1, instruction: 'Whisk eggs, milk, salt, and pepper together.' },
      { step: 2, instruction: 'Melt butter in a large skillet over medium-low heat.' },
      { step: 3, instruction: 'Pour in egg mixture and cook, stirring gently, until just set.' },
      { step: 4, instruction: 'Remove from heat while eggs are still slightly wet.' },
    ],
    notes: 'Do not overcook — eggs continue to set off heat.',
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'rec3', name: 'Mashed Potatoes', category: 'Starches', allergens: ['Dairy'],
    baseServings: 20,
    ingredients: [
      { qty: '15 lbs',  item: 'russet potatoes, peeled and cubed' },
      { qty: '1 cup',   item: 'butter' },
      { qty: '2 cups',  item: 'warm whole milk' },
      { qty: '2 tsp',   item: 'salt' },
    ],
    steps: [
      { step: 1, instruction: 'Boil potatoes until fork-tender, about 20 minutes.' },
      { step: 2, instruction: 'Drain thoroughly and return to pot.' },
      { step: 3, instruction: 'Mash with butter, then stir in warm milk.' },
      { step: 4, instruction: 'Season with salt, adjust consistency with more milk if needed.' },
    ],
    notes: 'For renal diet: omit butter and use water instead of milk.',
    createdAt: '2026-01-20T00:00:00Z', updatedAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'rec4', name: 'Chicken Noodle Soup', category: 'Soups', allergens: ['Gluten'],
    baseServings: 20,
    ingredients: [
      { qty: '5 lbs',   item: 'chicken breast, cooked and shredded' },
      { qty: '1 lb',    item: 'egg noodles' },
      { qty: '4',       item: 'carrots, sliced' },
      { qty: '4',       item: 'celery stalks, sliced' },
      { qty: '1',       item: 'onion, diced' },
      { qty: '3 quarts',item: 'chicken broth (low sodium)' },
      { qty: '2 tsp',   item: 'salt' },
      { qty: '1 tsp',   item: 'black pepper' },
    ],
    steps: [
      { step: 1, instruction: 'Sauté onion, carrots, and celery until soft.' },
      { step: 2, instruction: 'Add broth and bring to a boil.' },
      { step: 3, instruction: 'Add noodles and cook until tender, about 8 minutes.' },
      { step: 4, instruction: 'Stir in shredded chicken, season, and serve.' },
    ],
    notes: 'For pureed texture: blend all ingredients and strain. Thicken with cornstarch if needed.',
    createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-04-15T00:00:00Z',
  },
  {
    id: 'rec5', name: 'Snickerdoodle Cookies', category: 'Cookies', allergens: ['Gluten', 'Dairy', 'Eggs'],
    baseServings: 48,
    ingredients: [
      { qty: '2¾ cups', item: 'all-purpose flour' },
      { qty: '2 tsp',   item: 'cream of tartar' },
      { qty: '1 tsp',   item: 'baking soda' },
      { qty: '1 cup',   item: 'butter, softened' },
      { qty: '1½ cups', item: 'sugar' },
      { qty: '2',       item: 'large eggs' },
      { qty: '3 tbsp',  item: 'sugar (for rolling)' },
      { qty: '1 tbsp',  item: 'cinnamon (for rolling)' },
    ],
    steps: [
      { step: 1, instruction: 'Preheat oven to 375°F.' },
      { step: 2, instruction: 'Cream butter and 1½ cups sugar until fluffy.' },
      { step: 3, instruction: 'Beat in eggs. Mix in flour, cream of tartar, and baking soda.' },
      { step: 4, instruction: 'Roll dough into balls; coat in cinnamon-sugar mixture.' },
      { step: 5, instruction: 'Bake 8–10 minutes until edges are set.' },
    ],
    notes: 'Resident favorite for afternoon snack — bake fresh on Fridays.',
    createdAt: '2026-01-10T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

// ── Production sheet (today's lunch) ─────────────────────────────────────────
export const SEED_PRODUCTION_SHEETS: ProductionSheet[] = [
  {
    id: 'ps1',
    menuWeekId: 'wk1',
    day: 'Friday',
    slot: 'lunch',
    createdAt: '2026-07-03T06:00:00Z',
    updatedAt: '2026-07-03T06:00:00Z',
    counts: { total: 10, diningRoom: 6, room: 1, assistedLiving: 2, memoryCare: 1, absent: 2 },
    rows: [
      {
        menuItemId: 'mi12', menuItemName: 'Chicken Noodle Soup', textureModified: true,
        textureCounts: { Regular: 7, 'Cut-Up': 0, Minced: 1, 'Minced & Moist': 1, Pureed: 1, Liquid: 0 },
        dietCounts: { Regular: 5, Diabetic: 2, Cardiac: 1, Renal: 1, 'Low Sodium': 1, 'Mechanical Soft': 0 },
        locationCounts: { 'Dining Room': 6, Room: 1, 'Assisted Living': 2, 'Memory Care': 1 },
        total: 10,
      },
      {
        menuItemId: 'mi13', menuItemName: 'Dinner Roll', textureModified: true,
        textureCounts: { Regular: 7, 'Cut-Up': 1, Minced: 1, 'Minced & Moist': 1, Pureed: 0, Liquid: 0 },
        dietCounts: { Regular: 5, Diabetic: 2, Cardiac: 1, Renal: 0, 'Low Sodium': 1, 'Mechanical Soft': 1 },
        locationCounts: { 'Dining Room': 6, Room: 1, 'Assisted Living': 2, 'Memory Care': 1 },
        total: 10,
      },
      {
        menuItemId: 'mi10', menuItemName: 'Green Beans', textureModified: true,
        textureCounts: { Regular: 7, 'Cut-Up': 1, Minced: 1, 'Minced & Moist': 1, Pureed: 0, Liquid: 0 },
        dietCounts: { Regular: 5, Diabetic: 2, Cardiac: 1, Renal: 0, 'Low Sodium': 1, 'Mechanical Soft': 1 },
        locationCounts: { 'Dining Room': 6, Room: 1, 'Assisted Living': 2, 'Memory Care': 1 },
        total: 10,
      },
    ],
  },
]

// ── Admin users ───────────────────────────────────────────────────────────────
export const SEED_ADMIN_USERS: AdminUser[] = [
  { id: 'demo-admin-1',    name: 'Admin User',     email: 'admin@shoreline.demo',    role: 'admin',    active: true, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: '2026-07-03T06:22:00Z' },
  { id: 'demo-staff-1',    name: 'Staff User',     email: 'staff@shoreline.demo',    role: 'staff',    active: true, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: '2026-07-02T14:10:00Z' },
  { id: 'demo-readonly-1', name: 'Read-Only User', email: 'readonly@shoreline.demo', role: 'readonly', active: true, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null },
]

// ── Audit log ─────────────────────────────────────────────────────────────────
export const SEED_AUDIT_LOG: AuditLogEntry[] = [
  { id: 'al1', action: 'LOGIN',           userId: 'demo-admin-1', userName: 'Admin User',     timestamp: '2026-07-03T06:22:00Z', outcome: 'success' },
  { id: 'al2', action: 'RESIDENT_UPDATE', userId: 'demo-staff-1', userName: 'Staff User',     resourceId: 'r3', resourceType: 'resident', timestamp: '2026-07-02T14:15:00Z', outcome: 'success', details: { field: 'dietType', from: 'Regular', to: 'Cardiac' } },
  { id: 'al3', action: 'LOGIN',           userId: 'demo-staff-1', userName: 'Staff User',     timestamp: '2026-07-02T14:10:00Z', outcome: 'success' },
  { id: 'al4', action: 'LOGIN',           userId: 'demo-admin-1', userName: 'Admin User',     timestamp: '2026-07-01T08:00:00Z', outcome: 'success' },
  { id: 'al5', action: 'LOGIN',           userId: 'unknown',      timestamp: '2026-06-30T22:45:00Z', outcome: 'failure', details: { reason: 'bad credentials' } },
]

// ── System settings ───────────────────────────────────────────────────────────
export const SEED_SETTINGS: SystemSettings = {
  facilityName: 'Shoreline Care Center',
  timezone: 'America/New_York',
  sessionTimeoutMinutes: 15,
  mfaRequired: false,
  allowReadonlyExport: true,
  maintenanceMode: false,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function now() {
  return new Date().toISOString()
}
