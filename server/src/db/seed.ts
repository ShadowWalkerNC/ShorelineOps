import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from './pool'

// ── 1. REALISTIC RESIDENTS DATASET (54 RESIDENTS) ──────────────────────────
const FIRST_NAMES = [
  'Margaret', 'Robert', 'Dorothy', 'Harold', 'Evelyn', 'Frank', 'Beatrice', 'Walter',
  'Eleanor', 'Arthur', 'Mildred', 'George', 'Clara', 'Raymond', 'Florence', 'Edward',
  'Lillian', 'Albert', 'Ruth', 'Donald', 'Alice', 'Eugene', 'Helen', 'Howard',
  'Martha', 'Louis', 'Frances', 'Harry', 'Rose', 'Ralph', 'Marie', 'Paul',
  'Josephine', 'Carl', 'Theresa', 'Roy', 'Agnes', 'Fred', 'Grace', 'Henry',
  'Gladys', 'Richard', 'Bernice', 'Thomas', 'Gertrude', 'Lawrence', 'Edith', 'Norman',
  'Vera', 'Stanley', 'Hazel', 'Herbert', 'Lucille', 'Chester',
]

const LAST_NAMES = [
  'Holloway', 'Chen', 'Williams', 'Simmons', 'Torres', 'Patterson', 'Johnson', 'Kim',
  'O’Connor', 'Goldstein', 'Morrison', 'Kowalski', 'Dubois', 'Vanderbilt', 'Nadeau', 'Gallagher',
  'Thibodeau', 'MacDonald', 'Fontaine', 'Bouchard', 'Sorenson', 'Lindqvist', 'Petrov', 'Novak',
  'Cote', 'Pelletier', 'Gagnon', 'Roy', 'Belanger', 'Levesque', 'Fortin', 'Gingras',
  'Tremblay', 'Cloutier', 'Beaulieu', 'Caron', 'Michaud', 'Ouellet', 'Dube', 'Lavoie',
  'Broussard', 'Landry', 'Hebert', 'Theriault', 'Benoit', 'Daigle', 'Viel', 'Plourde',
  'Guerrette', 'St. Pierre', 'Deschamps', 'Charette', 'Boudreau', 'Cormier',
]

const DIET_TYPES = ['Regular', 'Diabetic', 'Low Sodium', 'Renal', 'Cardiac', 'Mechanical Soft']
const TEXTURES = ['Regular', 'Cut-Up', 'Minced', 'Minced & Moist', 'Pureed']
const ALLERGIES_POOL = [
  [],
  [],
  ['Nuts'],
  ['Dairy'],
  ['Gluten'],
  ['Shellfish'],
  ['Eggs'],
  ['Soy'],
  ['Fish'],
  ['Wheat'],
  ['Sesame'],
  ['Strawberries'],
  ['Dairy', 'Gluten'],
  ['Nuts', 'Seeds'],
]

const BEVERAGES_POOL = [
  ['Coffee', 'Water Only'],
  ['Tea', 'Juice'],
  ['Milk', 'Decaf'],
  ['Coffee', 'Juice'],
  ['Water Only'],
  ['Coffee', 'Milk'],
  ['Decaf', 'Hot Chocolate'],
  ['Tea'],
  ['Apple Juice', 'Prune Juice'],
  ['Cranberry Juice', 'Water'],
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function buildResidents() {
  const residents = []
  for (let i = 0; i < 54; i++) {
    const roomNum = 101 + i
    const wing = i < 20 ? 'Pine Wing' : i < 38 ? 'Ocean Wing' : 'Harbor Memory Care'
    const isMemoryCare = wing === 'Harbor Memory Care'
    const servingLoc = isMemoryCare ? 'Memory Care' : i % 5 === 0 ? 'Room' : 'Dining Room'
    const tableAssign = servingLoc === 'Memory Care' ? `MC-${(i % 3) + 1}` : servingLoc === 'Dining Room' ? `Table ${(i % 6) + 1}` : ''
    const status = i === 2 ? 'Hospital' : i === 7 ? 'LOA' : 'Active'
    const dietType = DIET_TYPES[i % DIET_TYPES.length]
    const texture = i % 8 === 0 ? 'Pureed' : i % 6 === 0 ? 'Minced & Moist' : i % 4 === 0 ? 'Cut-Up' : 'Regular'
    const portionSize = i % 5 === 0 ? 'Small' : i % 7 === 0 ? 'Large' : 'Regular'
    const ensurePerDay = i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0
    const allergies = ALLERGIES_POOL[i % ALLERGIES_POOL.length]
    const beverages = BEVERAGES_POOL[i % BEVERAGES_POOL.length]
    const bMonth = MONTHS[i % 12]
    const bDay = (i % 28) + 1

    residents.push({
      name: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
      room: String(roomNum),
      status,
      diet_type: dietType,
      texture,
      portion_size: portionSize,
      ensure_per_day: ensurePerDay,
      allergies,
      beverages,
      birthday_month: bMonth,
      birthday_day: bDay,
      serving_location: servingLoc,
      table_assignment: tableAssign,
      likes: i % 2 === 0 ? 'Oatmeal, fresh fruit, soup' : 'Roast chicken, coffee, puddings',
      dislikes: i % 3 === 0 ? 'Spicy food, onions' : 'Cold entrees, fish',
      special_instructions: texture === 'Pureed' ? 'IDDSI Level 4 Puree with nectar-thick liquids' : isMemoryCare ? 'Cueing needed for meal initiation' : '',
    })
  }
  return residents
}

// ── 2. VENDOR CATALOG GENERATOR (500+ BROADLINE SKUS) ──────────────────────
interface MockCatalogItem {
  sku: string
  name: string
  brand: string
  packSize: string
  uom: string
  category: string
  unitCost: number
}

const CATEGORY_TEMPLATES: Record<string, { prefixes: string[]; items: string[]; packSizes: string[]; basePrice: number }> = {
  'Meat & Poultry': {
    prefixes: ['Fresh Choice', 'Tyson', 'Hormel', 'Perdue', 'Smithfield', 'Cargill'],
    items: [
      'Boneless Skinless Chicken Breast 4oz', 'Ground Beef 80/20 Fresh', 'Pork Tenderloin Trimmed',
      'Roast Beef Top Round Choice', 'Turkey Breast Smoked Sliced', 'Chicken Thighs Boneless Skinless',
      'Beef Stew Meat Diced 1-inch', 'Pork Chops Center Cut Bone-in', 'Chicken Fritters Homestyle Breaded',
      'Meatballs Cooked 1/2 oz Italian Style', 'Bacon 18/22 Count Thick Cut', 'Breakfast Sausage Links 1oz Cooked',
      'Ham Buffet Style Boneless Water Added', 'Beef Liver Sliced IQF', 'Cod Fillets 4oz Skinless Icelandic',
      'Haddock Loins 5oz IQF', 'Salmon Portions 5oz Atlantic Skin-on', 'Crab Cakes 3oz Maryland Style',
    ],
    packSizes: ['4/10 lb', '2/10 lb', '1/10 lb', '12/1 lb', '1/40 lb Case'],
    basePrice: 42.50,
  },
  'Dairy & Cheese': {
    prefixes: ['Cabot', 'Hood', 'Oakhurst', 'Land O Lakes', 'Kraft', 'Sorrento'],
    items: [
      'Whole Milk Fresh 1 Gal', '2% Lowfat Milk Half Pint', '1% Lowfat Milk Half Pint',
      'Skim Milk Half Pint', 'Heavy Cream 36% 1 Qt', 'Sour Cream Cultured Tub',
      'Cottage Cheese 4% Small Curd', 'American Cheese Sliced 160ct', 'Cheddar Cheese Mild Shredded',
      'Mozzarella Cheese Part Skim Shredded', 'Swiss Cheese Sliced Sandwich', 'Butter Solid Salted Grade A',
      'Butter Solid Unsalted Grade A', 'Butter Cups 5g Continentals', 'Vanilla Yogurt Lowfat Bulk 5lb',
      'Greek Yogurt Plain Lowfat', 'Cream Cheese Plain Loaf', 'Parmesan Cheese Grated Tub',
    ],
    packSizes: ['4/1 gal', '50/8 oz', '12/32 oz', '4/5 lb', '36/1 lb', '1000/5 g'],
    basePrice: 24.80,
  },
  'Produce': {
    prefixes: ['Maine Grown', 'Freshway', 'Dole', 'Taylor Farms', 'Grimmway', 'Sunkist'],
    items: [
      'Russet Potatoes 70ct Idaho', 'Carrots Whole Peeled 2-inch Baby', 'Yellow Onions Jumbo Cleaned',
      'Broccoli Florets Washed Ready-to-Use', 'Cauliflower Florets Fresh Washed', 'Celery Sticks 4-inch Diced',
      'Romaine Lettuce Chopped Cleaned', 'Iceberg Lettuce Shredded 1/8-inch', 'Spring Mix Baby Greens Organic',
      'Bananas Petite Single Serve Yellow', 'Apples Gala 100ct Crisp', 'Oranges Navel 88ct Sweet',
      'Cantaloupe Chunks Fresh Cut 5lb', 'Honeydew Melon Chunks Fresh Cut 5lb', 'Strawberries Fresh Flat 8/1lb',
      'Blueberries Fresh Flat 12/6oz', 'Zucchini Squash Medium Sliced', 'Yellow Squash Sliced Rounds',
    ],
    packSizes: ['1/50 lb', '4/5 lb', '1/25 lb', '2/5 lb Case', '8/1 lb', '12/6 oz'],
    basePrice: 21.00,
  },
  'Dry Goods & Grains': {
    prefixes: ['Uncle Bens', 'Quaker', 'General Mills', 'Barilla', 'Sysco Classic', 'Dennis Select'],
    items: [
      'Long Grain White Rice Enriched', 'Brown Rice Whole Grain Parboiled', 'Rolled Oats Quick Cooking',
      'Cream of Wheat Instant Cereal', 'Cheerios Cereal Single Serve Bowls', 'Corn Flakes Cereal Single Serve Bowls',
      'Elbow Macaroni Enriched Semolina', 'Spaghetti Pasta Long Enriched', 'Egg Noodles Wide Homestyle',
      'All Purpose Flour Bleached Enriched', 'Granulated White Sugar Pure Cane', 'Brown Sugar Light Pure Cane',
      'Cornstarch Pure Food Starch', 'Baking Powder Double Acting', 'Baking Soda Pure Food Grade',
      'Chicken Bouillon Base Low Sodium', 'Beef Bouillon Base Low Sodium', 'Vegetable Soup Base No MSG',
    ],
    packSizes: ['1/25 lb', '1/50 lb', '12/42 oz', '96/1 oz', '2/10 lb', '12/2 lb', '6/1 lb'],
    basePrice: 19.50,
  },
  'Canned Goods': {
    prefixes: ['Bushs', 'Hunts', 'Del Monte', 'Libbys', 'Heinz', 'Campbell'],
    items: [
      'Green Beans Cut Blue Lake #10', 'Sweet Corn Whole Kernel #10', 'Sweet Peas Early June #10',
      'Crushed Tomatoes in Puree #10', 'Diced Tomatoes in Juice #10', 'Tomato Paste 26% #10',
      'Tomato Soup Condensed #10', 'Chicken Noodle Soup Condensed #10', 'Cream of Mushroom Soup Condensed #10',
      'Sliced Peaches in Light Syrup #10', 'Pear Halves in Light Syrup #10', 'Applesauce Unsweetened Fancy #10',
      'Fruit Cocktail in Light Syrup #10', 'Pineapple Tidbits in Juice #10', 'Pinto Beans Cooked #10',
    ],
    packSizes: ['6/#10 Cans', '12/46 oz', '24/15 oz'],
    basePrice: 28.50,
  },
  'Frozen Foods': {
    prefixes: ['Ore-Ida', 'Simplot', 'Green Giant', 'Richs', 'McCain', 'Sara Lee'],
    items: [
      'French Fries Straight Cut 3/8-inch', 'Tater Tots Seasoned Crispy', 'Mashed Potatoes Frozen Homestyle Scoop',
      'Mixed Vegetables 4-Way Frozen', 'Green Peas Sweet Petite IQF', 'Cut Corn Sweet Golden IQF',
      'Cut Green Beans Fancy IQF', 'Waffles Homestyle 1.5oz Toaster', 'Pancakes Buttermilk 4-inch Pre-cooked',
      'Dinner Rolls Proof & Bake White', 'Biscuit Dough 2.5oz Buttermilk', 'Pie Crust 9-inch Deep Dish Unbaked',
    ],
    packSizes: ['6/5 lb', '12/2 lb', '96/1.5 oz', '120/2.5 oz', '20/9 inch'],
    basePrice: 26.00,
  },
  'Beverages': {
    prefixes: ['Ocean Spray', 'Welchs', 'Folgers', 'Lipton', 'Mott’s', 'Nestle'],
    items: [
      'Orange Juice 100% Frozen Concentrate 4+1', 'Apple Juice 100% Frozen Concentrate 4+1',
      'Cranberry Cocktail Juice Bag-in-Box 3 Gal', 'Prune Juice 100% Pure Bottled 48oz',
      'Coffee Ground Regular Hotel Blend 2.5oz Frac', 'Coffee Ground Decaf Hotel Blend 2.5oz Frac',
      'Black Tea Bags Single Serve Tagless', 'Chamomile Herbal Tea Bags Enveloped',
      'Hot Cocoa Mix Single Serve Packets', 'Lemonade Drink Mix Powder 12/24oz',
    ],
    packSizes: ['12/32 oz', '1/3 gal BIB', '8/48 oz', '42/2.5 oz Frac', '100/1 ct', '6/50 ct'],
    basePrice: 31.00,
  },
  'Clinical Supplements & Thickener': {
    prefixes: ['Abbott', 'Nestle HealthScience', 'Thick-It', 'Gelmix', 'Hormel Health'],
    items: [
      'Ensure Plus Vanilla 8oz Ready-to-Drink', 'Ensure Plus Chocolate 8oz Ready-to-Drink',
      'Ensure Plus Strawberry 8oz Ready-to-Drink', 'Glucerna Vanilla 8oz Carb-Steady',
      'Nepro with Carb Steady 8oz Renal Vanilla', 'Food Thickener Instant Powder 10oz Can',
      'Food Thickener Clear Starch 8oz Tub', 'Thickened Water Nectar Level 2 46oz',
      'Thickened Water Honey Level 3 46oz', 'Thickened Apple Juice Nectar Level 2 4oz Cups',
    ],
    packSizes: ['24/8 oz', '12/10 oz', '8/46 oz', '48/4 oz'],
    basePrice: 48.00,
  },
  'Paper, Disposable & Cleaning': {
    prefixes: ['Georgia Pacific', 'Dart', 'Ecolab', 'Dawn', 'Boardman', 'Tork'],
    items: [
      'Dinner Napkins 2-Ply 1/8 Fold White', 'Tray Liners 14x18 Paper Embossed White',
      'Hot Beverage Cups 8oz Paper Insulated', 'Clear Drink Tumbler 9oz Plastic Dispo',
      'Plastic Dinner Plates 9-inch Heavy Duty', 'Disposable Cutlery Kit Fork/Knife/Spoon/Napkin',
      'Nitrile Gloves Powder-Free Large Blue', 'Nitrile Gloves Powder-Free Medium Blue',
      'Dawn Heavy Duty Pot & Pan Detergent 1 Gal', 'Oasis 146 Multi-Quat Sanitizer 2.5 Gal',
    ],
    packSizes: ['12/250 ct', '1000/Case', '20/50 ct', '10/100 ct Box', '4/1 gal', '1/2.5 gal'],
    basePrice: 38.00,
  },
}

function generateCatalog(vendorId: string, vendorPrefix: string, count: number = 260): MockCatalogItem[] {
  const items: MockCatalogItem[] = []
  const categories = Object.keys(CATEGORY_TEMPLATES)
  let skuIndex = 10001

  while (items.length < count) {
    for (const cat of categories) {
      if (items.length >= count) break
      const template = CATEGORY_TEMPLATES[cat]
      const brand = template.prefixes[items.length % template.prefixes.length]
      const itemName = template.items[items.length % template.items.length]
      const packSize = template.packSizes[items.length % template.packSizes.length]
      const variance = (items.length % 9) * 0.75 - 3.0
      const unitCost = Number((template.basePrice + variance).toFixed(2))

      items.push({
        sku: `${vendorPrefix}-${skuIndex++}`,
        name: `${brand} ${itemName}`,
        brand,
        packSize,
        uom: packSize.includes('Case') || packSize.includes('/') ? 'case' : 'pack',
        category: cat,
        unitCost,
      })
    }
  }
  return items
}

// ── 3. MAIN SEED RUNNER ───────────────────────────────────────────────────
export async function runSeed() {
  console.log('======================================================================')
  console.log('  SHORELINE CARE OS — SEEDING REALISTIC MULTI-FACILITY ENTERPRISE')
  console.log('======================================================================\n')

  // 1. Users Setup
  const defaultPass = 'admin123'
  const hash = await bcrypt.hash(defaultPass, 10)

  const USERS_TO_SEED = [
    { email: 'admin@shoreline.local', name: 'System Administrator', role: 'admin' },
    { email: 'chef@shoreline.local', name: 'Marcus Vance, CDM, CFPP', role: 'manager' },
    { email: 'rdn@shoreline.local', name: 'Sarah Jenkins, MS, RDN, LD', role: 'manager' },
    { email: 'cook@shoreline.local', name: 'Carlos Mendez, Lead Line Cook', role: 'dietary' },
    { email: 'frontdesk@shoreline.local', name: 'Front Desk Concierge', role: 'frontdesk' },
  ]

  for (const u of USERS_TO_SEED) {
    await pool.query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [crypto.randomUUID(), u.name, u.email, hash, u.role]
    )
  }
  console.log(`[*] Seeded ${USERS_TO_SEED.length} core role users (default password: ${defaultPass})`)

  // 2. Facilities Setup (3 facilities in facility_config & settings)
  const FACILITIES = [
    {
      id: 'fac-shoreline',
      name: 'Shoreline Healthcare Center',
      type: 'Skilled Nursing & Rehab',
      address: '142 Ocean View Road, Portland, ME 04101',
      email: 'admin@shoreline.local',
      beds: 75,
      wings: JSON.stringify(['Pine Wing (101-120)', 'Ocean Wing (121-138)', 'Harbor Memory Care (139-154)']),
      dining: JSON.stringify(['Main Dining Room', 'Ocean Bistro', 'Memory Care Dining', 'Tray Delivery']),
    },
    {
      id: 'fac-harborview',
      name: 'Harbor View Senior Living',
      type: 'Assisted Living & Memory Care',
      address: '88 Capitol Boulevard, Augusta, ME 04330',
      email: 'director@harborview.local',
      beds: 60,
      wings: JSON.stringify(['North Wing', 'South Wing', 'Gardens Memory Care']),
      dining: JSON.stringify(['St. Croix Dining Room', 'Private Family Room', 'Tray Delivery']),
    },
    {
      id: 'fac-atlantic',
      name: 'Atlantic Rehabilitation & Care',
      type: 'Sub-Acute Healthcare & Long-Term Care',
      address: '312 Penobscot Street, Bangor, ME 04401',
      email: 'admissions@atlanticrehab.local',
      beds: 90,
      wings: JSON.stringify(['Rehab Wing A', 'Rehab Wing B', 'Long-Term Pavilion', 'Comfort Care Unit']),
      dining: JSON.stringify(['Grand Dining Pavilion', 'Rehab Cafe', 'Room Service Delivery']),
    },
  ]

  for (const f of FACILITIES) {
    await pool.query(
      `INSERT INTO facility_config (id, facility_name, primary_contact_email, facility_type, address, wings, dining_rooms, is_initialized)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (id) DO NOTHING`,
      [f.id, f.name, f.email, f.type, f.address, f.wings, f.dining]
    )
  }
  // Ensure 'default' points to Shoreline
  await pool.query(
    `INSERT INTO facility_config (id, facility_name, primary_contact_email, facility_type, address, wings, dining_rooms, is_initialized)
     VALUES ('default', 'Shoreline Healthcare Center', 'admin@shoreline.local', 'Skilled Nursing & Rehab', '142 Ocean View Road, Portland, ME 04101', $1, $2, true)
     ON CONFLICT (id) DO NOTHING`,
    [FACILITIES[0].wings, FACILITIES[0].dining]
  )
  console.log(`[*] Seeded 3 multi-site healthcare facilities`)

  // 3. Residents Setup (54 residents)
  const residentsList = buildResidents()
  for (const r of residentsList) {
    await pool.query(
      `INSERT INTO residents
        (id, name, room, status, diet_type, texture, portion_size, ensure_per_day,
         allergies, beverages, birthday_month, birthday_day, serving_location,
         table_assignment, likes, dislikes, special_instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT DO NOTHING`,
      [
        crypto.randomUUID(), r.name, r.room, r.status, r.diet_type, r.texture, r.portion_size,
        r.ensure_per_day, r.allergies, r.beverages, r.birthday_month,
        r.birthday_day, r.serving_location, r.table_assignment,
        r.likes, r.dislikes, r.special_instructions,
      ]
    )
  }
  console.log(`[*] Seeded ${residentsList.length} realistic residents (Diabetic, Renal, Pureed L4, Minced L5, NPO)`)

  // 4. Vendors & 500+ Catalog Items
  const VENDORS = [
    { name: 'Dennis Food Service', code: 'dennis', website: 'https://dennisfoodservice.com', notes: 'Primary Broadline Distributor (Maine & New England regional specialist)' },
    { name: 'Sysco Corporation', code: 'sysco', website: 'https://sysco.com', notes: 'National Broadline Foodservice Partner — contracted secondary supplier' },
    { name: 'US Foods', code: 'usfoods', website: 'https://usfoods.com', notes: 'Contracted Tertiary Supplier for competitive MRP pricing' },
  ]

  const vendorMap: Record<string, string> = {}
  for (const v of VENDORS) {
    await pool.query(
      `INSERT INTO vendors (id, name, code, website, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING`,
      [crypto.randomUUID(), v.name, v.code, v.website, v.notes]
    )
    let { rows } = await pool.query('SELECT id FROM vendors WHERE code = $1', [v.code])
    if (rows[0] && !rows[0].id) {
      const generatedId = crypto.randomUUID()
      await pool.query('UPDATE vendors SET id = $1 WHERE code = $2', [generatedId, v.code])
      vendorMap[v.code] = generatedId
    } else if (rows[0]) {
      vendorMap[v.code] = rows[0].id
    }
  }

  // Generate 260 items for Dennis + 260 items for Sysco = 520 items
  const dennisCatalog = generateCatalog(vendorMap['dennis'], 'DNS', 260)
  const syscoCatalog = generateCatalog(vendorMap['sysco'], 'SYS', 260)
  const allCatalogItems = [
    ...dennisCatalog.map(i => ({ ...i, vendorId: vendorMap['dennis'] })),
    ...syscoCatalog.map(i => ({ ...i, vendorId: vendorMap['sysco'] })),
  ]

  let insertedCount = 0
  for (const item of allCatalogItems) {
    const itemId = crypto.randomUUID()
    await pool.query(
      `INSERT INTO vendor_items (id, vendor_id, vendor_sku, name, brand, pack_size, uom, category, unit_cost, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (vendor_id, vendor_sku) DO NOTHING`,
      [itemId, item.vendorId, item.sku, item.name, item.brand, item.packSize, item.uom, item.category, item.unitCost]
    )
    insertedCount++
  }
  console.log(`[*] Seeded ${insertedCount} vendor items across Dennis Food Service and Sysco (500+ SKU Catalog)`)

  // 4b. Canonical Products & Cross-Vendor Matches ("Match & Crush")
  const CANONICAL_STAPLES = [
    { name: 'Boneless Skinless Chicken Breast 4oz', category: 'Meat & Poultry', standardUom: 'lb', allergens: [], keyword: 'Chicken Breast' },
    { name: 'Ground Beef 80/20 Fresh', category: 'Meat & Poultry', standardUom: 'lb', allergens: [], keyword: 'Ground Beef' },
    { name: 'Broccoli Florets Fresh/IQF', category: 'Produce & Fruits', standardUom: 'lb', allergens: [], keyword: 'Broccoli' },
    { name: 'Russet Potatoes #1 Burbank', category: 'Produce & Fruits', standardUom: 'lb', allergens: [], keyword: 'Potatoes' },
    { name: 'Whole Milk Grade A Gallon', category: 'Dairy & Refrigerated', standardUom: 'gal', allergens: ['Dairy'], keyword: 'Milk' },
    { name: 'Salted Sweet Cream Butter', category: 'Dairy & Refrigerated', standardUom: 'lb', allergens: ['Dairy'], keyword: 'Butter' },
    { name: 'Orange Juice Thickened Nectar L3', category: 'Dietary & Thickened', standardUom: 'gal', allergens: [], keyword: 'Orange Juice' },
    { name: 'Pureed Green Beans IDDSI L4', category: 'Dietary & Thickened', standardUom: 'lb', allergens: [], keyword: 'Green Beans' },
  ]

  let matchCount = 0
  for (const staple of CANONICAL_STAPLES) {
    const canonId = crypto.randomUUID()
    await pool.query(
      `INSERT INTO canonical_products (id, name, category, standard_uom, allergens)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [canonId, staple.name, staple.category, staple.standardUom, staple.allergens]
    )

    const { rows: [canon] } = await pool.query('SELECT id FROM canonical_products WHERE name = $1', [staple.name])
    if (!canon) continue

    // Find candidate vendor items from Dennis and Sysco
    const { rows: candidateItems } = await pool.query(
      `SELECT vi.*, v.code as vendor_code
       FROM vendor_items vi
       JOIN vendors v ON v.id = vi.vendor_id
       WHERE vi.name LIKE $1
       LIMIT 4`,
      [`%${staple.keyword}%`]
    )

    for (const vItem of candidateItems) {
      // Approximate pack quantity based on standardUom
      let packUnits = 10
      if (staple.standardUom === 'gal') packUnits = 4
      else if (staple.standardUom === 'lb') packUnits = vItem.pack_size.includes('20') ? 20 : 10
      else packUnits = 6

      const unitCost = parseFloat(vItem.unit_cost || '0')
      const normalizedCost = packUnits > 0 ? Math.round((unitCost / packUnits) * 10000) / 10000 : unitCost

      await pool.query(
        `INSERT INTO vendor_item_matches
           (id, canonical_product_id, vendor_item_id, pack_quantity_in_standard_uom, normalized_unit_cost, match_confidence, match_status, matched_by)
         VALUES ($1, $2, $3, $4, $5, 95.0, 'confirmed', 'seed_bootstrap')
         ON CONFLICT (canonical_product_id, vendor_item_id) DO NOTHING`,
        [crypto.randomUUID(), canon.id, vItem.id, packUnits, normalizedCost]
      )
      matchCount++
    }
  }
  console.log(`[*] Seeded ${CANONICAL_STAPLES.length} canonical products and ${matchCount} cross-vendor item matches`)

  // 5. Master Institutional Recipes
  const { rows: recipeCount } = await pool.query('SELECT COUNT(*) FROM recipes')
  if (parseInt(recipeCount[0]?.count || '0') === 0) {
    const recipesToSeed = [
      {
        name: 'Oven Herb Roasted Chicken Breast',
        category: 'Proteins',
        baseServings: 20,
        prepTimeMins: 15,
        cookTimeMins: 35,
        haccpTempF: 165,
        iddsiLevel: 7,
        allergens: [],
        ingredients: [
          { qty: '10 lbs', item: 'chicken breast', vendorSku: 'DNS-10001', estimatedCost: 32.50 },
          { qty: '0.5 cup', item: 'oil', vendorSku: 'DNS-10002', estimatedCost: 1.20 },
        ],
        steps: [
          { step: 1, instruction: 'Preheat convection oven to 375°F.' },
          { step: 2, instruction: 'Season chicken with garlic, rosemary, thyme, and black pepper (no added salt).' },
          { step: 3, instruction: 'Bake for 35 mins until internal core temperature reaches 165°F on calibrated thermometer.' },
        ],
        notes: 'NAS & NCS compliant. Low sodium base.',
      },
      {
        name: 'Steamed Broccoli with Lemon Butter',
        category: 'Veggies',
        baseServings: 20,
        prepTimeMins: 10,
        cookTimeMins: 12,
        haccpTempF: 140,
        iddsiLevel: 6,
        allergens: ['Dairy'],
        ingredients: [
          { qty: '6 lbs', item: 'broccoli florets', vendorSku: 'DNS-10003', estimatedCost: 12.00 },
          { qty: '0.5 cup', item: 'butter', vendorSku: 'DNS-10004', estimatedCost: 2.00 },
        ],
        steps: [
          { step: 1, instruction: 'Steam broccoli florets until tender-crisp (8-10 mins).' },
          { step: 2, instruction: 'Toss gently with melted butter and fresh lemon juice.' },
        ],
        notes: 'Can be pureed with thickener for IDDSI Level 4.',
      },
      {
        name: 'Homestyle Mashed Potatoes',
        category: 'Starches',
        baseServings: 20,
        prepTimeMins: 15,
        cookTimeMins: 25,
        haccpTempF: 140,
        iddsiLevel: 5,
        allergens: ['Dairy'],
        ingredients: [
          { qty: '8 lbs', item: 'russet potatoes', vendorSku: 'DNS-10005', estimatedCost: 8.50 },
          { qty: '2 cups', item: 'whole milk', vendorSku: 'DNS-10006', estimatedCost: 1.50 },
          { qty: '1 cup', item: 'butter', vendorSku: 'DNS-10004', estimatedCost: 4.00 },
        ],
        steps: [
          { step: 1, instruction: 'Peel and boil potatoes in unsalted water until fork tender.' },
          { step: 2, instruction: 'Drain and mash with warm milk and butter until smooth.' },
        ],
        notes: 'Suitable for Mechanical Soft. Blend with milk for Pureed.',
      },
      {
        name: 'IDDSI Pureed Beef & Root Veggie Medley',
        category: 'Proteins',
        baseServings: 15,
        prepTimeMins: 20,
        cookTimeMins: 40,
        haccpTempF: 165,
        iddsiLevel: 4,
        allergens: [],
        ingredients: [
          { qty: '5 lbs', item: 'ground beef 80/20', vendorSku: 'DNS-10007', estimatedCost: 18.00 },
          { qty: '3 lbs', item: 'russet potatoes', vendorSku: 'DNS-10005', estimatedCost: 3.50 },
          { qty: '0.5 cup', item: 'food thickener', vendorSku: 'DNS-10008', estimatedCost: 2.50 },
        ],
        steps: [
          { step: 1, instruction: 'Brown ground beef thoroughly to 165°F and simmer with root vegetables.' },
          { step: 2, instruction: 'Transfer to Robot Coupe commercial food processor with warm broth.' },
          { step: 3, instruction: 'Process until completely smooth, cohesive, holding shape on spoon (IDDSI Level 4 test).' },
        ],
        notes: 'Formulated specifically for Dysphagia & Pureed diet orders.',
      },
    ]

    for (const rec of recipesToSeed) {
      const recipeId = crypto.randomUUID()
      await pool.query(`
        INSERT INTO recipes (id, name, category, base_servings, prep_time_mins, cook_time_mins, haccp_temp_f, iddsi_level, allergens, ingredients, steps, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        recipeId, rec.name, rec.category, rec.baseServings, rec.prepTimeMins, rec.cookTimeMins,
        rec.haccpTempF, rec.iddsiLevel, rec.allergens,
        JSON.stringify(rec.ingredients), JSON.stringify(rec.steps), rec.notes,
      ])

      await pool.query(`
        INSERT INTO recipe_nutrients (recipe_id, calories, protein_g, carbs_g, fat_g, sat_fat_g, sodium_mg, potassium_mg, phosphorus_mg, fiber_g, sugar_g)
        VALUES ($1, 240, 22, 14, 8, 2.5, 180, 340, 160, 2.5, 1.2)
        ON CONFLICT DO NOTHING
      `, [recipeId])
    }
    console.log(`[*] Seeded ${recipesToSeed.length} master institutional recipes`)
  }

  console.log('\n[seed] Multi-facility dataset seeding complete.')
}

if (require.main === module) {
  import('dotenv/config').then(() =>
    runSeed()
      .then(() => pool.end())
      .catch((e) => { console.error(e); process.exit(1) })
  )
}
