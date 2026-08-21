/**
 * ============================================================
 * DEMO SEED DATA
 * ============================================================
 */
import type { Resident } from '@/types/resident'
import type { MenuItem, MenuWeek } from '@/types/menu'
import type { Recipe } from '@/types/recipe'
import type { ProductionSheet } from '@/types/production'
import type { AdminUser, AuditLogEntry, SystemSettings } from '@/types/admin'

// ── Residents ───────────────────────────────────────────────────────────────────
export const SEED_RESIDENTS: Resident[] = [
  { id: 'r1',  name: 'Eleanor Whitfield',  room: '101', status: 'Active',     dietType: 'Regular',         texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 1, allergies: [],              beverages: ['Coffee', 'Juice'],         birthdayMonth: 'March',     birthdayDay: 14, servingLocation: 'Dining Room',     tableAssignment: 'A1',  likes: 'Soup, fruit cups',           dislikes: 'Spicy food',      specialInstructions: '' },
  { id: 'r2',  name: 'Harold Minter',      room: '102', status: 'Active',     dietType: 'Diabetic',        texture: 'Regular',       portionSize: 'Small',   ensurePerDay: 2, allergies: ['Nuts'],         beverages: ['Decaf', 'Water Only'],    birthdayMonth: 'July',      birthdayDay: 3,  servingLocation: 'Dining Room',     tableAssignment: 'A2',  likes: 'Eggs, toast',                dislikes: 'Greasy food',     specialInstructions: 'Check blood sugar before meals' },
  { id: 'r3',  name: 'Dorothy Callahan',   room: '104', status: 'Active',     dietType: 'Cardiac',         texture: 'Cut-Up',        portionSize: 'Regular', ensurePerDay: 1, allergies: ['Dairy'],        beverages: ['Tea', 'Juice'],           birthdayMonth: 'November',  birthdayDay: 22, servingLocation: 'Room',            tableAssignment: '',    likes: 'Oatmeal, bananas',           dislikes: 'Red meat',        specialInstructions: 'Serve in room — mobility issues' },
  { id: 'r4',  name: 'Frank Russo',        room: '105', status: 'Active',     dietType: 'Low Sodium',      texture: 'Regular',       portionSize: 'Large',   ensurePerDay: 0, allergies: [],              beverages: ['Coffee', 'Milk'],         birthdayMonth: 'September', birthdayDay: 8,  servingLocation: 'Dining Room',     tableAssignment: 'B1',  likes: 'Pasta, bread',               dislikes: 'Fish',            specialInstructions: '' },
  { id: 'r5',  name: 'Margaret Tran',      room: '106', status: 'Active',     dietType: 'Renal',           texture: 'Pureed',        portionSize: 'Small',   ensurePerDay: 2, allergies: ['Gluten'],       beverages: ['Water Only'],            birthdayMonth: 'February',  birthdayDay: 17, servingLocation: 'Memory Care',     tableAssignment: 'MC1', likes: 'Applesauce, pudding',        dislikes: 'Strong flavors',  specialInstructions: 'Fluid restriction 1200 ml/day' },
  { id: 'r6',  name: 'Charles Okonkwo',    room: '107', status: 'Active',     dietType: 'Regular',         texture: 'Minced',        portionSize: 'Regular', ensurePerDay: 1, allergies: [],              beverages: ['Coffee', 'Hot Chocolate'],birthdayMonth: 'June',      birthdayDay: 5,  servingLocation: 'Assisted Living', tableAssignment: 'AL2', likes: 'Chicken, rice',              dislikes: 'Salads',          specialInstructions: '' },
  { id: 'r7',  name: 'Beatrice Larson',    room: '109', status: 'Hospital',   dietType: 'Diabetic',        texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 1, allergies: ['Strawberries'], beverages: ['Tea'],                   birthdayMonth: 'April',     birthdayDay: 30, servingLocation: 'Dining Room',     tableAssignment: 'B2',  likes: 'Salad, yogurt',              dislikes: 'Fried food',      specialInstructions: 'Currently hospitalized' },
  { id: 'r8',  name: 'George Patel',       room: '110', status: 'Active',     dietType: 'Mechanical Soft', texture: 'Minced & Moist', portionSize: 'Regular', ensurePerDay: 2, allergies: ['Seeds'],        beverages: ['Milk', 'Decaf'],          birthdayMonth: 'December',  birthdayDay: 1,  servingLocation: 'Dining Room',     tableAssignment: 'A3',  likes: 'Mashed potatoes, gravy',     dislikes: 'Crunchy foods',   specialInstructions: 'Dentures — minced & moist only' },
  { id: 'r9',  name: 'Helen Fitzgerald',   room: '111', status: 'Active',     dietType: 'Regular',         texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 0, allergies: [],              beverages: ['Coffee', 'Juice'],        birthdayMonth: 'August',    birthdayDay: 19, servingLocation: 'Dining Room',     tableAssignment: 'C1',  likes: 'Pancakes, sausage',          dislikes: 'Vegetables',      specialInstructions: '' },
  { id: 'r10', name: 'Walter Nguyen',      room: '112', status: 'LOA',        dietType: 'Regular',         texture: 'Regular',       portionSize: 'Regular', ensurePerDay: 0, allergies: [],              beverages: ['Coffee'],                birthdayMonth: 'October',   birthdayDay: 12, servingLocation: 'Dining Room',     tableAssignment: 'C2',  likes: 'Burgers, fries',             dislikes: 'Seafood',         specialInstructions: 'On leave until next week' },
  { id: 'r11', name: 'Sylvia Moreau',      room: '114', status: 'Active',     dietType: 'Cardiac',         texture: 'Regular',       portionSize: 'Small',   ensurePerDay: 1, allergies: ['Caffeine'],     beverages: ['Decaf', 'Tea'],           birthdayMonth: 'May',       birthdayDay: 25, servingLocation: 'Assisted Living', tableAssignment: 'AL1', likes: 'Fish, steamed veggies',      dislikes: 'Red meat, salt',  specialInstructions: 'No added salt' },
  { id: 'r12', name: 'Thomas Kerr',        room: '115', status: 'Active',     dietType: 'Regular',         texture: 'Regular',       portionSize: 'Large',   ensurePerDay: 0, allergies: [],              beverages: ['Coffee', 'Milk'],         birthdayMonth: 'January',   birthdayDay: 9,  servingLocation: 'Dining Room',     tableAssignment: 'B3',  likes: 'Steak, potatoes',            dislikes: 'Tofu',            specialInstructions: '' },
]

// ── Menu items ───────────────────────────────────────────────────────────────────
export const SEED_MENU_ITEMS: MenuItem[] = [
  // Breakfast
  { id: 'mi1',  name: 'Scrambled Eggs',         textureModified: true },
  { id: 'mi2',  name: 'Toast with Butter',       textureModified: true },
  { id: 'mi3',  name: 'Oatmeal',                 textureModified: true,  notes: 'Can add brown sugar or cinnamon' },
  { id: 'mi4',  name: 'Pancakes',                textureModified: true },
  { id: 'mi5',  name: 'Orange Juice',            textureModified: false },
  { id: 'mi6',  name: 'Fresh Fruit Cup',         textureModified: false },
  // Meats
  { id: 'mi8',  name: 'Grilled Chicken Breast',  textureModified: true },
  { id: 'mi14', name: 'Baked Salmon',             textureModified: true },
  { id: 'mi17', name: 'Beef Pot Roast',           textureModified: true },
  { id: 'mi25', name: 'Pork Chop',                textureModified: true },
  { id: 'mi26', name: 'Turkey Meatloaf',          textureModified: true },
  // Veggies
  { id: 'mi10', name: 'Green Beans',             textureModified: true },
  { id: 'mi15', name: 'Steamed Broccoli',         textureModified: true },
  { id: 'mi27', name: 'Glazed Carrots',           textureModified: true },
  { id: 'mi28', name: 'Corn',                     textureModified: true },
  { id: 'mi29', name: 'Peas',                     textureModified: true },
  // Starches
  { id: 'mi9',  name: 'Mashed Potatoes',         textureModified: true },
  { id: 'mi16', name: 'Brown Rice',               textureModified: true },
  { id: 'mi18', name: 'Egg Noodles',              textureModified: true },
  { id: 'mi30', name: 'Baked Potato',             textureModified: true },
  { id: 'mi31', name: 'Mac & Cheese',             textureModified: true },
  // Desserts
  { id: 'mi19', name: 'Applesauce',              textureModified: false },
  { id: 'mi20', name: 'Pudding Cup',             textureModified: false },
  { id: 'mi32', name: 'Vanilla Ice Cream',        textureModified: false },
  { id: 'mi33', name: 'Fruit Cobbler',            textureModified: false },
  { id: 'mi34', name: 'Jello',                    textureModified: false },
]

// ── Menu weeks ───────────────────────────────────────────────────────────────────
export const SEED_MENU_WEEKS: MenuWeek[] = [
  {
    id: 'wk1',
    name: 'Cycle 1',
    active: true,
    effectiveFrom: '2026-06-30',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-28T00:00:00Z',
    days: {
      Sunday: {
        breakfast:       { itemIds: ['mi3','mi2','mi5'] },
        lunchOpt1Meat:   { itemIds: ['mi8'] },  lunchOpt1Veggie: { itemIds: ['mi10'] }, lunchOpt1Starch: { itemIds: ['mi9'] },
        lunchOpt2Meat:   { itemIds: ['mi14'] }, lunchOpt2Veggie: { itemIds: ['mi15'] }, lunchOpt2Starch: { itemIds: ['mi16'] },
        lunchDessert:    { itemIds: ['mi20'] },
        dinnerOpt1Meat:  { itemIds: ['mi17'] }, dinnerOpt1Veggie: { itemIds: ['mi28'] }, dinnerOpt1Starch: { itemIds: ['mi18'] },
        dinnerOpt2Meat:  { itemIds: ['mi25'] }, dinnerOpt2Veggie: { itemIds: ['mi27'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi32'] },
      },
      Monday: {
        breakfast:       { itemIds: ['mi1','mi2','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi8'] },  lunchOpt1Veggie: { itemIds: ['mi15'] }, lunchOpt1Starch: { itemIds: ['mi9'] },
        lunchOpt2Meat:   { itemIds: ['mi26'] }, lunchOpt2Veggie: { itemIds: ['mi29'] }, lunchOpt2Starch: { itemIds: ['mi31'] },
        lunchDessert:    { itemIds: ['mi19'] },
        dinnerOpt1Meat:  { itemIds: ['mi14'] }, dinnerOpt1Veggie: { itemIds: ['mi10'] }, dinnerOpt1Starch: { itemIds: ['mi16'] },
        dinnerOpt2Meat:  { itemIds: ['mi17'] }, dinnerOpt2Veggie: { itemIds: ['mi27'] }, dinnerOpt2Starch: { itemIds: ['mi18'] },
        dinnerDessert:   { itemIds: ['mi34'] },
      },
      Tuesday: {
        breakfast:       { itemIds: ['mi4','mi5','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi17'] }, lunchOpt1Veggie: { itemIds: ['mi28'] }, lunchOpt1Starch: { itemIds: ['mi18'] },
        lunchOpt2Meat:   { itemIds: ['mi8'] },  lunchOpt2Veggie: { itemIds: ['mi10'] }, lunchOpt2Starch: { itemIds: ['mi16'] },
        lunchDessert:    { itemIds: ['mi33'] },
        dinnerOpt1Meat:  { itemIds: ['mi25'] }, dinnerOpt1Veggie: { itemIds: ['mi15'] }, dinnerOpt1Starch: { itemIds: ['mi9'] },
        dinnerOpt2Meat:  { itemIds: ['mi26'] }, dinnerOpt2Veggie: { itemIds: ['mi29'] }, dinnerOpt2Starch: { itemIds: ['mi31'] },
        dinnerDessert:   { itemIds: ['mi20'] },
      },
      Wednesday: {
        breakfast:       { itemIds: ['mi3','mi1','mi5'] },
        lunchOpt1Meat:   { itemIds: ['mi14'] }, lunchOpt1Veggie: { itemIds: ['mi27'] }, lunchOpt1Starch: { itemIds: ['mi30'] },
        lunchOpt2Meat:   { itemIds: ['mi26'] }, lunchOpt2Veggie: { itemIds: ['mi15'] }, lunchOpt2Starch: { itemIds: ['mi9'] },
        lunchDessert:    { itemIds: ['mi32'] },
        dinnerOpt1Meat:  { itemIds: ['mi8'] },  dinnerOpt1Veggie: { itemIds: ['mi10'] }, dinnerOpt1Starch: { itemIds: ['mi16'] },
        dinnerOpt2Meat:  { itemIds: ['mi17'] }, dinnerOpt2Veggie: { itemIds: ['mi28'] }, dinnerOpt2Starch: { itemIds: ['mi18'] },
        dinnerDessert:   { itemIds: ['mi34'] },
      },
      Thursday: {
        breakfast:       { itemIds: ['mi1','mi4','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi25'] }, lunchOpt1Veggie: { itemIds: ['mi29'] }, lunchOpt1Starch: { itemIds: ['mi9'] },
        lunchOpt2Meat:   { itemIds: ['mi8'] },  lunchOpt2Veggie: { itemIds: ['mi15'] }, lunchOpt2Starch: { itemIds: ['mi31'] },
        lunchDessert:    { itemIds: ['mi19'] },
        dinnerOpt1Meat:  { itemIds: ['mi14'] }, dinnerOpt1Veggie: { itemIds: ['mi27'] }, dinnerOpt1Starch: { itemIds: ['mi16'] },
        dinnerOpt2Meat:  { itemIds: ['mi26'] }, dinnerOpt2Veggie: { itemIds: ['mi10'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi33'] },
      },
      Friday: {
        breakfast:       { itemIds: ['mi3','mi2','mi5'] },
        lunchOpt1Meat:   { itemIds: ['mi8'] },  lunchOpt1Veggie: { itemIds: ['mi10'] }, lunchOpt1Starch: { itemIds: ['mi9'] },
        lunchOpt2Meat:   { itemIds: ['mi14'] }, lunchOpt2Veggie: { itemIds: ['mi15'] }, lunchOpt2Starch: { itemIds: ['mi16'] },
        lunchDessert:    { itemIds: ['mi20'] },
        dinnerOpt1Meat:  { itemIds: ['mi17'] }, dinnerOpt1Veggie: { itemIds: ['mi28'] }, dinnerOpt1Starch: { itemIds: ['mi18'] },
        dinnerOpt2Meat:  { itemIds: ['mi25'] }, dinnerOpt2Veggie: { itemIds: ['mi29'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi32'] },
      },
      Saturday: {
        breakfast:       { itemIds: ['mi4','mi6','mi5'] },
        lunchOpt1Meat:   { itemIds: ['mi17'] }, lunchOpt1Veggie: { itemIds: ['mi27'] }, lunchOpt1Starch: { itemIds: ['mi18'] },
        lunchOpt2Meat:   { itemIds: ['mi26'] }, lunchOpt2Veggie: { itemIds: ['mi28'] }, lunchOpt2Starch: { itemIds: ['mi31'] },
        lunchDessert:    { itemIds: ['mi34'] },
        dinnerOpt1Meat:  { itemIds: ['mi8'] },  dinnerOpt1Veggie: { itemIds: ['mi15'] }, dinnerOpt1Starch: { itemIds: ['mi9'] },
        dinnerOpt2Meat:  { itemIds: ['mi14'] }, dinnerOpt2Veggie: { itemIds: ['mi10'] }, dinnerOpt2Starch: { itemIds: ['mi16'] },
        dinnerDessert:   { itemIds: ['mi19'] },
      },
    },
  },
  {
    id: 'wk2',
    name: 'Cycle 2',
    active: false,
    effectiveFrom: '2026-07-07',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-28T00:00:00Z',
    days: {
      Sunday: {
        breakfast:       { itemIds: ['mi4','mi5','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi26'] }, lunchOpt1Veggie: { itemIds: ['mi15'] }, lunchOpt1Starch: { itemIds: ['mi31'] },
        lunchOpt2Meat:   { itemIds: ['mi8'] },  lunchOpt2Veggie: { itemIds: ['mi28'] }, lunchOpt2Starch: { itemIds: ['mi9'] },
        lunchDessert:    { itemIds: ['mi33'] },
        dinnerOpt1Meat:  { itemIds: ['mi14'] }, dinnerOpt1Veggie: { itemIds: ['mi29'] }, dinnerOpt1Starch: { itemIds: ['mi16'] },
        dinnerOpt2Meat:  { itemIds: ['mi17'] }, dinnerOpt2Veggie: { itemIds: ['mi27'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi20'] },
      },
      Monday: {
        breakfast:       { itemIds: ['mi1','mi3','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi17'] }, lunchOpt1Veggie: { itemIds: ['mi10'] }, lunchOpt1Starch: { itemIds: ['mi18'] },
        lunchOpt2Meat:   { itemIds: ['mi25'] }, lunchOpt2Veggie: { itemIds: ['mi27'] }, lunchOpt2Starch: { itemIds: ['mi30'] },
        lunchDessert:    { itemIds: ['mi19'] },
        dinnerOpt1Meat:  { itemIds: ['mi8'] },  dinnerOpt1Veggie: { itemIds: ['mi15'] }, dinnerOpt1Starch: { itemIds: ['mi9'] },
        dinnerOpt2Meat:  { itemIds: ['mi26'] }, dinnerOpt2Veggie: { itemIds: ['mi29'] }, dinnerOpt2Starch: { itemIds: ['mi31'] },
        dinnerDessert:   { itemIds: ['mi34'] },
      },
      Tuesday: {
        breakfast:       { itemIds: ['mi4','mi2','mi5'] },
        lunchOpt1Meat:   { itemIds: ['mi14'] }, lunchOpt1Veggie: { itemIds: ['mi28'] }, lunchOpt1Starch: { itemIds: ['mi16'] },
        lunchOpt2Meat:   { itemIds: ['mi8'] },  lunchOpt2Veggie: { itemIds: ['mi15'] }, lunchOpt2Starch: { itemIds: ['mi9'] },
        lunchDessert:    { itemIds: ['mi32'] },
        dinnerOpt1Meat:  { itemIds: ['mi17'] }, dinnerOpt1Veggie: { itemIds: ['mi10'] }, dinnerOpt1Starch: { itemIds: ['mi18'] },
        dinnerOpt2Meat:  { itemIds: ['mi25'] }, dinnerOpt2Veggie: { itemIds: ['mi27'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi20'] },
      },
      Wednesday: {
        breakfast:       { itemIds: ['mi3','mi1','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi8'] },  lunchOpt1Veggie: { itemIds: ['mi29'] }, lunchOpt1Starch: { itemIds: ['mi31'] },
        lunchOpt2Meat:   { itemIds: ['mi14'] }, lunchOpt2Veggie: { itemIds: ['mi10'] }, lunchOpt2Starch: { itemIds: ['mi16'] },
        lunchDessert:    { itemIds: ['mi33'] },
        dinnerOpt1Meat:  { itemIds: ['mi26'] }, dinnerOpt1Veggie: { itemIds: ['mi15'] }, dinnerOpt1Starch: { itemIds: ['mi9'] },
        dinnerOpt2Meat:  { itemIds: ['mi17'] }, dinnerOpt2Veggie: { itemIds: ['mi28'] }, dinnerOpt2Starch: { itemIds: ['mi18'] },
        dinnerDessert:   { itemIds: ['mi19'] },
      },
      Thursday: {
        breakfast:       { itemIds: ['mi4','mi5','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi25'] }, lunchOpt1Veggie: { itemIds: ['mi27'] }, lunchOpt1Starch: { itemIds: ['mi30'] },
        lunchOpt2Meat:   { itemIds: ['mi26'] }, lunchOpt2Veggie: { itemIds: ['mi15'] }, lunchOpt2Starch: { itemIds: ['mi9'] },
        lunchDessert:    { itemIds: ['mi34'] },
        dinnerOpt1Meat:  { itemIds: ['mi14'] }, dinnerOpt1Veggie: { itemIds: ['mi10'] }, dinnerOpt1Starch: { itemIds: ['mi16'] },
        dinnerOpt2Meat:  { itemIds: ['mi8'] },  dinnerOpt2Veggie: { itemIds: ['mi29'] }, dinnerOpt2Starch: { itemIds: ['mi31'] },
        dinnerDessert:   { itemIds: ['mi20'] },
      },
      Friday: {
        breakfast:       { itemIds: ['mi1','mi2','mi5'] },
        lunchOpt1Meat:   { itemIds: ['mi17'] }, lunchOpt1Veggie: { itemIds: ['mi28'] }, lunchOpt1Starch: { itemIds: ['mi18'] },
        lunchOpt2Meat:   { itemIds: ['mi8'] },  lunchOpt2Veggie: { itemIds: ['mi10'] }, lunchOpt2Starch: { itemIds: ['mi9'] },
        lunchDessert:    { itemIds: ['mi32'] },
        dinnerOpt1Meat:  { itemIds: ['mi25'] }, dinnerOpt1Veggie: { itemIds: ['mi15'] }, dinnerOpt1Starch: { itemIds: ['mi16'] },
        dinnerOpt2Meat:  { itemIds: ['mi26'] }, dinnerOpt2Veggie: { itemIds: ['mi27'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi33'] },
      },
      Saturday: {
        breakfast:       { itemIds: ['mi3','mi4','mi6'] },
        lunchOpt1Meat:   { itemIds: ['mi8'] },  lunchOpt1Veggie: { itemIds: ['mi15'] }, lunchOpt1Starch: { itemIds: ['mi9'] },
        lunchOpt2Meat:   { itemIds: ['mi14'] }, lunchOpt2Veggie: { itemIds: ['mi29'] }, lunchOpt2Starch: { itemIds: ['mi16'] },
        lunchDessert:    { itemIds: ['mi19'] },
        dinnerOpt1Meat:  { itemIds: ['mi17'] }, dinnerOpt1Veggie: { itemIds: ['mi10'] }, dinnerOpt1Starch: { itemIds: ['mi18'] },
        dinnerOpt2Meat:  { itemIds: ['mi25'] }, dinnerOpt2Veggie: { itemIds: ['mi28'] }, dinnerOpt2Starch: { itemIds: ['mi30'] },
        dinnerDessert:   { itemIds: ['mi34'] },
      },
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
    id: 'rec5', name: 'Herb-Roasted Turkey Breast', category: 'Mains', allergens: [],
    baseServings: 20,
    ingredients: [
      { qty: '8 lbs',   item: 'boneless turkey breast' },
      { qty: '3 tbsp',  item: 'olive oil' },
      { qty: '1 tbsp',  item: 'dried thyme' },
      { qty: '1 tbsp',  item: 'dried rosemary' },
      { qty: '1 tsp',   item: 'garlic powder' },
      { qty: '1 tsp',   item: 'paprika' },
      { qty: '1 tsp',   item: 'black pepper' },
    ],
    steps: [
      { step: 1, instruction: 'Rub turkey breast with olive oil, herbs, and spices.' },
      { step: 2, instruction: 'Roast at 350°F until internal temperature reaches 165°F (approx 75 mins).' },
      { step: 3, instruction: 'Rest 15 minutes before carving across the grain.' },
      { step: 4, instruction: 'Serve with low-sodium poultry gravy.' },
    ],
    notes: 'Low-sodium compliant (NAS). For mechanical soft: finely dice and moisten with warm broth.',
    createdAt: '2026-02-10T00:00:00Z', updatedAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'rec6', name: 'Steamed Green Beans Almandine (Nut-Free Option)', category: 'Vegetables', allergens: [],
    baseServings: 20,
    ingredients: [
      { qty: '6 lbs',   item: 'fresh green beans, trimmed' },
      { qty: '3 tbsp',  item: 'butter or olive oil' },
      { qty: '1 tsp',   item: 'lemon juice' },
      { qty: '1 tsp',   item: 'garlic powder' },
      { qty: '½ tsp',   item: 'black pepper' },
    ],
    steps: [
      { step: 1, instruction: 'Steam green beans for 6-8 minutes until crisp-tender.' },
      { step: 2, instruction: 'Toss immediately with melted butter, lemon juice, and seasonings.' },
      { step: 3, instruction: 'Hold warm at 145°F for service.' },
    ],
    notes: 'For IDDSI Level 4 Pureed: steam until very soft, puree with vegetable broth in commercial blender.',
    createdAt: '2026-02-15T00:00:00Z', updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'rec7', name: 'Baked Atlantic Salmon with Dill', category: 'Mains', allergens: [],
    baseServings: 20,
    ingredients: [
      { qty: '20 (4oz)',item: 'salmon fillets' },
      { qty: '¼ cup',   item: 'lemon juice' },
      { qty: '2 tbsp',  item: 'fresh dill, chopped' },
      { qty: '2 tbsp',  item: 'olive oil' },
      { qty: '½ tsp',   item: 'garlic powder' },
    ],
    steps: [
      { step: 1, instruction: 'Arrange salmon fillets on parchment-lined sheet pans.' },
      { step: 2, instruction: 'Drizzle with olive oil, lemon juice, and season with dill and garlic.' },
      { step: 3, instruction: 'Bake at 375°F for 12-15 minutes until internal temp reaches 145°F.' },
    ],
    notes: 'Naturally cardiac and renal friendly. Flakes easily for soft diet modifications.',
    createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'rec8', name: 'Sugar-Free Vanilla Bean Pudding', category: 'Desserts', allergens: ['Dairy'],
    baseServings: 20,
    ingredients: [
      { qty: '2 pkgs',  item: 'sugar-free instant vanilla pudding mix' },
      { qty: '2 quarts',item: 'cold whole milk (or fortified soy milk)' },
      { qty: '1 tsp',   item: 'pure vanilla extract' },
    ],
    steps: [
      { step: 1, instruction: 'Whisk pudding mix into cold milk and vanilla for 2 minutes.' },
      { step: 2, instruction: 'Portion ½ cup into individual chilled dessert dishes.' },
      { step: 3, instruction: 'Refrigerate at 38°F for at least 30 minutes before meal service.' },
    ],
    notes: 'No Concentrated Sweets (NCS) / Diabetic approved. Suitable for all dysphagia levels.',
    createdAt: '2026-03-12T00:00:00Z', updatedAt: '2026-03-12T00:00:00Z',
  },
]

// ── Production sheet ───────────────────────────────────────────────────────────────
export const SEED_PRODUCTION_SHEETS: ProductionSheet[] = [
  {
    id: 'ps1',
    menuWeekId: 'wk1',
    day: 'Friday',
    slot: 'lunchOpt1Meat',
    createdAt: '2026-07-03T06:00:00Z',
    updatedAt: '2026-07-03T06:00:00Z',
    counts: { total: 10, diningRoom: 6, room: 1, assistedLiving: 2, memoryCare: 1, absent: 2 },
    rows: [
      {
        menuItemId: 'mi8', menuItemName: 'Grilled Chicken Breast', textureModified: true,
        textureCounts: { Regular: 7, 'Cut-Up': 0, Minced: 1, 'Minced & Moist': 1, Pureed: 1, Liquid: 0 },
        dietCounts: { Regular: 5, Diabetic: 2, Cardiac: 1, Renal: 1, 'Low Sodium': 1, 'Mechanical Soft': 0 },
        locationCounts: { 'Dining Room': 6, Room: 1, 'Assisted Living': 2, 'Memory Care': 1 },
        total: 10,
      },
    ],
  },
]

// ── Admin users ───────────────────────────────────────────────────────────────────
export const SEED_ADMIN_USERS: AdminUser[] = [
  { id: 'demo-admin-1',    name: 'Admin User',     email: 'admin@shoreline.demo',    role: 'admin',    active: true, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: '2026-07-03T06:22:00Z' },
  { id: 'demo-staff-1',    name: 'Staff User',     email: 'staff@shoreline.demo',    role: 'staff',    active: true, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: '2026-07-02T14:10:00Z' },
  { id: 'demo-readonly-1', name: 'Read-Only User', email: 'readonly@shoreline.demo', role: 'readonly', active: true, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null },
]

// ── Audit log ───────────────────────────────────────────────────────────────────
export const SEED_AUDIT_LOG: AuditLogEntry[] = [
  { id: 'al1', action: 'LOGIN',           userId: 'demo-admin-1', userName: 'Admin User', timestamp: '2026-07-03T06:22:00Z', outcome: 'success' },
  { id: 'al2', action: 'RESIDENT_UPDATE', userId: 'demo-staff-1', userName: 'Staff User', resourceId: 'r3', resourceType: 'resident', timestamp: '2026-07-02T14:15:00Z', outcome: 'success', details: { field: 'dietType', from: 'Regular', to: 'Cardiac' } },
  { id: 'al3', action: 'LOGIN',           userId: 'demo-staff-1', userName: 'Staff User', timestamp: '2026-07-02T14:10:00Z', outcome: 'success' },
  { id: 'al4', action: 'LOGIN',           userId: 'demo-admin-1', userName: 'Admin User', timestamp: '2026-07-01T08:00:00Z', outcome: 'success' },
  { id: 'al5', action: 'LOGIN',           userId: 'unknown',      timestamp: '2026-06-30T22:45:00Z', outcome: 'failure', details: { reason: 'bad credentials' } },
]

// ── System settings ───────────────────────────────────────────────────────────────
export const SEED_SETTINGS: SystemSettings = {
  facilityName: 'Shoreline Care Center',
  timezone: 'America/New_York',
  sessionTimeoutMinutes: 15,
  mfaRequired: false,
  allowReadonlyExport: true,
  maintenanceMode: false,
  kitchenServiceMode: 'hybrid',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function now() {
  return new Date().toISOString()
}
