"use strict";
/**
 * Cross-Vendor Catalog Matching & Normalization Engine ("Match & Crush")
 * ShorelineOps & CulinaryOS Core Purchasing Service
 *
 * Solves broadline distributor SKU obfuscation and fragmented pack sizes
 * (Dennis vs Sysco vs US Foods) by:
 * 1. Mathematically normalizing pack sizes (e.g. 40/4oz vs 2/10lb vs 1/20lb) into standard units (lbs, fl oz, each).
 * 2. Normalizing unit costs to standardized base units ($/lb, $/fl oz, $/each).
 * 3. Fuzzy string matching incoming distributor SKUs to Canonical Products.
 * 4. Solving the Cross-Vendor Price Comparison Matrix with winner determination and cost savings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceMatrixSolver = exports.FuzzyProductMatcher = exports.PackSizeNormalizer = void 0;
exports.dimensionOf = dimensionOf;
/** Common foodservice abbreviations dictionary */
const ABBREVIATIONS = {
    'b/s': 'boneless skinless',
    'bnls': 'boneless',
    'sknls': 'skinless',
    'chk': 'chicken',
    'chkn': 'chicken',
    'chic': 'chicken',
    'brst': 'breast',
    'bf': 'beef',
    'grnd': 'ground',
    'pot': 'potatoes',
    'pots': 'potatoes',
    'broc': 'broccoli',
    'veg': 'vegetables',
    'puree': 'pureed',
    'thk': 'thickened',
    'thknd': 'thickened',
    'oj': 'orange juice',
    'frz': 'frozen',
    'frzn': 'frozen',
    'slcd': 'sliced',
    'dcd': 'diced',
    'whl': 'whole',
    'mlk': 'milk',
    'btr': 'butter',
    'ct': 'count',
    'cs': 'case',
    'bx': 'box',
    'pk': 'pack',
};
/**
 * Coarse unit dimension for apples-to-apples ranking. F7: mass, volume,
 * and count offers must never be price-ranked against each other.
 * Unknown dimensions stay ranked for backward compatibility, never excluded.
 */
function dimensionOf(uom) {
    const u = (uom || '').trim().toLowerCase();
    if (['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'].includes(u))
        return 'mass';
    if (['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'fl oz', 'floz', 'fluid ounce', 'fluid ounces', 'qt', 'quart', 'quarts', 'gal', 'gallon', 'gallons'].includes(u))
        return 'volume';
    if (['each', 'ea', 'case', 'cs', 'box', 'bx', 'pack', 'pk', 'ct', 'count', 'can', '#10 can', 'bag'].includes(u))
        return 'count';
    return 'unknown';
}
class PackSizeNormalizer {
    /**
     * Normalize an arbitrary distributor pack size string and case cost
     * e.g.:
     *   "40/4oz", $64.20 -> 10 lbs, $6.42/lb
     *   "2/10 lb", $58.50 -> 20 lbs, $2.925/lb
     *   "6/#10 cans", $48.00 -> 6 cans, $8.00/can (or 39 lbs, $1.23/lb)
     *   "12/32oz", $32.75 -> 384 fl oz, $0.085/fl oz
     *   "50 lb", $25.00 -> 50 lbs, $0.50/lb
     */
    static normalize(packSize, caseCost) {
        const raw = (packSize || '').trim().toLowerCase();
        const cost = Math.max(0, Number(caseCost) || 0);
        if (!raw) {
            return { totalStandardUnits: 1, standardUom: 'case', normalizedUnitCost: cost };
        }
        // Pattern 1a: Count / Size in fluid ounces — VOLUME, never weight
        // (e.g. "12/32 fl oz"). F7: fluid ounces were previously folded into pounds.
        const countFlOzMatch = raw.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?)\s*fl\s*oz/i);
        if (countFlOzMatch) {
            const count = parseFloat(countFlOzMatch[1]);
            const flOz = parseFloat(countFlOzMatch[2]);
            const totalFlOz = count * flOz;
            const normalizedCost = totalFlOz > 0 ? Math.round((cost / totalFlOz) * 10000) / 10000 : cost;
            return { totalStandardUnits: totalFlOz, standardUom: 'fl oz', normalizedUnitCost: normalizedCost };
        }
        // Pattern 1b: Count / Size with weight ounces (e.g. "40/4oz", "24/4 oz")
        const countOzMatch = raw.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:oz|ounce)/i);
        if (countOzMatch) {
            const count = parseFloat(countOzMatch[1]);
            const oz = parseFloat(countOzMatch[2]);
            const totalOz = count * oz;
            const totalLbs = totalOz / 16;
            const normalizedCost = totalLbs > 0 ? Math.round((cost / totalLbs) * 10000) / 10000 : cost;
            return { totalStandardUnits: totalLbs, standardUom: 'lb', normalizedUnitCost: normalizedCost };
        }
        // Pattern 2: Count / Size with lbs (e.g. "2/10 lb", "6/5 lbs", "4/5#", "1/20 lb")
        const countLbMatch = raw.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:lb|lbs|#)/i);
        if (countLbMatch) {
            const count = parseFloat(countLbMatch[1]);
            const lbs = parseFloat(countLbMatch[2]);
            const totalLbs = count * lbs;
            const normalizedCost = totalLbs > 0 ? Math.round((cost / totalLbs) * 10000) / 10000 : cost;
            return { totalStandardUnits: totalLbs, standardUom: 'lb', normalizedUnitCost: normalizedCost };
        }
        // Pattern 3: #10 cans (e.g. "6/#10 cans", "6/#10", "6/10 can")
        const num10Match = raw.match(/^(\d+)\s*\/\s*#?10/i);
        if (num10Match) {
            const count = parseFloat(num10Match[1]);
            const normalizedCost = count > 0 ? Math.round((cost / count) * 10000) / 10000 : cost;
            return { totalStandardUnits: count, standardUom: '#10 can', normalizedUnitCost: normalizedCost };
        }
        // Pattern 4: Volume gallons / quarts (e.g. "4/1 gal", "12/1 qt")
        const countGalMatch = raw.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?)\s*gal/i);
        if (countGalMatch) {
            const count = parseFloat(countGalMatch[1]);
            const gal = parseFloat(countGalMatch[2]);
            const totalGal = count * gal;
            const normalizedCost = totalGal > 0 ? Math.round((cost / totalGal) * 10000) / 10000 : cost;
            return { totalStandardUnits: totalGal, standardUom: 'gal', normalizedUnitCost: normalizedCost };
        }
        // Pattern 5: Straight weight (e.g. "50 lb", "50#", "25 lbs bag", "cs 50 lb")
        const straightLbMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|#)/i);
        if (straightLbMatch) {
            const totalLbs = parseFloat(straightLbMatch[1]);
            const normalizedCost = totalLbs > 0 ? Math.round((cost / totalLbs) * 10000) / 10000 : cost;
            return { totalStandardUnits: totalLbs, standardUom: 'lb', normalizedUnitCost: normalizedCost };
        }
        // Pattern 5b: Straight fluid ounces (e.g. "32 fl oz") — volume
        const straightFlOzMatch = raw.match(/(\d+(?:\.\d+)?)\s*fl\s*oz/i);
        if (straightFlOzMatch) {
            const totalFlOz = parseFloat(straightFlOzMatch[1]);
            const normalizedCost = totalFlOz > 0 ? Math.round((cost / totalFlOz) * 10000) / 10000 : cost;
            return { totalStandardUnits: totalFlOz, standardUom: 'fl oz', normalizedUnitCost: normalizedCost };
        }
        // Default fallback: 1 case
        return {
            totalStandardUnits: 1,
            standardUom: 'case',
            normalizedUnitCost: cost,
        };
    }
}
exports.PackSizeNormalizer = PackSizeNormalizer;
class FuzzyProductMatcher {
    /**
     * Clean and normalize product title using culinary abbreviation dictionary
     */
    static cleanTitle(title) {
        let clean = (title || '').toLowerCase().replace(/[^a-z0-9\s/]/g, ' ');
        const tokens = clean.split(/\s+/).filter(Boolean);
        const expanded = tokens.map(t => ABBREVIATIONS[t] || t);
        return expanded.join(' ');
    }
    /**
     * Extract key content tokens, eliminating pure numeric/pack tokens
     */
    static extractTokens(text) {
        const cleaned = this.cleanTitle(text);
        const stopWords = new Set(['and', 'in', 'of', 'with', 'for', 'the', 'raw', 'cs', 'case', 'box', 'pack']);
        return new Set(cleaned
            .split(/\s+/)
            .filter(t => t.length > 1 && !stopWords.has(t) && !/^\d+$/.test(t)));
    }
    /**
     * Compute Jaccard token similarity between candidate item and canonical product (0 to 100).
     * This is an uncalibrated string-similarity heuristic, not a probability of correctness.
     */
    static scoreMatch(candidateName, canonicalName) {
        const candTokens = this.extractTokens(candidateName);
        const canonTokens = this.extractTokens(canonicalName);
        if (candTokens.size === 0 || canonTokens.size === 0)
            return 0;
        let intersection = 0;
        for (const token of candTokens) {
            if (canonTokens.has(token)) {
                intersection++;
            }
            else {
                // Partial substring match (e.g. "chicken" matches "chickens")
                for (const cToken of canonTokens) {
                    if (cToken.includes(token) || token.includes(cToken)) {
                        intersection += 0.8;
                        break;
                    }
                }
            }
        }
        const union = candTokens.size + canonTokens.size - intersection;
        if (union <= 0)
            return 0;
        const jaccard = Math.min(1.0, intersection / union);
        return Math.round(jaccard * 100);
    }
    /**
     * Find best canonical product match candidate
     */
    static findBestMatch(candidateName, canonicalProducts) {
        let bestProduct = null;
        let highestConfidence = 0;
        for (const canon of canonicalProducts) {
            const confidence = this.scoreMatch(candidateName, canon.name);
            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestProduct = canon;
            }
        }
        return { canonicalProduct: bestProduct, confidence: highestConfidence };
    }
}
exports.FuzzyProductMatcher = FuzzyProductMatcher;
class PriceMatrixSolver {
    /**
     * Aggregate matched vendor items into an apples-to-apples price comparison matrix
     */
    static solveMatrix(canonicalProducts, matches) {
        const rows = [];
        for (const canon of canonicalProducts) {
            // F6: only human-approved equivalents are purchase-comparable.
            // Review candidates never influence the winner or savings.
            const productOffers = matches
                .filter(m => m.matchStatus === 'confirmed')
                .filter(m => m.canonicalProductId === canon.id || m.canonical_product_id === canon.id);
            // F7: rank only offers sharing the canonical dimension.
            const canonDim = dimensionOf(canon.standardUom);
            const rankableOffers = productOffers.filter(m => {
                const d = dimensionOf(m.normalizedUom || '');
                return d === 'unknown' || canonDim === 'unknown' || d === canonDim;
            });
            // Sort by lowest normalized unit cost
            const sortedOffers = [...rankableOffers].sort((a, b) => a.normalizedUnitCost - b.normalizedUnitCost);
            let winningVendor;
            let runnerUpVendor;
            let costSavingsPerUnit = 0;
            let variancePercent = 0;
            if (sortedOffers.length > 0) {
                const win = sortedOffers[0];
                winningVendor = {
                    vendorCode: win.vendorCode,
                    vendorName: win.vendorName,
                    normalizedUnitCost: win.normalizedUnitCost,
                    caseCost: win.caseCost,
                    packSize: win.packSize,
                };
                if (sortedOffers.length > 1) {
                    const runner = sortedOffers[1];
                    runnerUpVendor = {
                        vendorCode: runner.vendorCode,
                        vendorName: runner.vendorName,
                        normalizedUnitCost: runner.normalizedUnitCost,
                    };
                    costSavingsPerUnit = Math.max(0, Math.round((runner.normalizedUnitCost - win.normalizedUnitCost) * 1000) / 1000);
                    if (win.normalizedUnitCost > 0) {
                        variancePercent = Math.round(((runner.normalizedUnitCost - win.normalizedUnitCost) / win.normalizedUnitCost) * 1000) / 10;
                    }
                }
            }
            rows.push({
                canonicalId: canon.id,
                canonicalName: canon.name,
                category: canon.category,
                standardUom: canon.standardUom,
                allergens: canon.allergens || [],
                offers: productOffers,
                winningVendor,
                runnerUpVendor,
                costSavingsPerUnit,
                variancePercent,
            });
        }
        return rows;
    }
}
exports.PriceMatrixSolver = PriceMatrixSolver;
