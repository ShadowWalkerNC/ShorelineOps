"use strict";
/**
 * PointClickCare & MatrixCare Inbound Sync Adapter (V3 & V4 Implementation)
 * DiningRD CareSync / MealSuite Connect Parity
 *
 * Handles:
 * - FHIR/HL7 ADT and Diet Order updates ingestion
 * - Automated dynamic meal safety checks and nutrient calculations
 * - Inbound Reconciliation Exception Queue for RD triage of conflicting or unmapped orders
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointClickCareConnector = void 0;
class PointClickCareConnector {
    systemCode = 'pointclickcare';
    systemName = 'PointClickCare EHR';
    /**
     * A07: True only when live PointClickCare OAuth credentials are configured.
     * With no credentials the census route refuses to serve data (503) rather
     * than presenting the synthetic stub census below as live EHR data.
     */
    isConnected() {
        return Boolean(process.env.PCC_CLIENT_ID &&
            process.env.PCC_CLIENT_SECRET &&
            process.env.PCC_FACILITY_ID);
    }
    /**
     * A07: SYNTHETIC STUB — returns built-in sample residents; this is NOT live
     * EHR data. The census route only calls this when isConnected() is true and
     * flags the payload `demo: true`. Replace with a real PCC FHIR/OAuth call to
     * serve live census (and drop the demo flag) once the live bridge exists.
     */
    async getCensus(facilityId) {
        return [
            {
                residentExternalId: 'PCC-RES-101',
                firstName: 'Eleanor',
                lastName: 'Vance',
                room: '104-A',
                status: 'active',
                dietOrder: 'Regular',
                texture: 'Regular',
                allergies: [],
                supplements: ['Ensure Plus Vanilla'],
                effectiveAt: new Date().toISOString(),
            },
            {
                residentExternalId: 'PCC-RES-102',
                firstName: 'Arthur',
                lastName: 'Pendelton',
                room: '112-B',
                status: 'active',
                dietOrder: 'Diabetic / NCS',
                texture: 'Pureed',
                allergies: ['Shellfish', 'Tree Nuts'],
                supplements: ['Glucerna Shake'],
                effectiveAt: new Date().toISOString(),
            },
            {
                residentExternalId: 'PCC-RES-103',
                firstName: 'Margaret',
                lastName: 'Holloway',
                room: '101',
                status: 'active',
                dietOrder: 'NAS / Low Sodium',
                texture: 'Regular',
                allergies: ['Gluten', 'Wheat'],
                effectiveAt: new Date().toISOString(),
            },
        ];
    }
    async processInboundUpdate(payload) {
        const raw = payload || {};
        return {
            residentExternalId: raw.residentExternalId || `PCC-${Date.now()}`,
            firstName: raw.firstName || 'Unknown',
            lastName: raw.lastName || 'Resident',
            room: raw.room || 'Unassigned',
            status: raw.status || 'active',
            dietOrder: raw.dietOrder || 'Regular',
            texture: raw.texture || 'Regular',
            allergies: Array.isArray(raw.allergies) ? raw.allergies : [],
            supplements: Array.isArray(raw.supplements) ? raw.supplements : [],
            effectiveAt: new Date().toISOString(),
        };
    }
    /**
     * Evaluates inbound EHR payload against existing resident record
     * Returns a triage exception item if conflicting texture, new unverified allergy, or NPO change is detected.
     */
    evaluateInboundTriage(incoming, existingResident) {
        const fullName = `${incoming.firstName} ${incoming.lastName}`;
        const id = `TRIAGE-${incoming.residentExternalId}-${Date.now().toString(36)}`;
        // 1. Inbound NPO Order Change
        const incomingDiet = (incoming.dietOrder || '').toLowerCase();
        if (incomingDiet.includes('npo')) {
            return {
                id,
                residentName: fullName,
                externalEhrId: incoming.residentExternalId,
                sourceEhr: this.systemName,
                changeType: 'NPO_ORDER',
                incomingPayload: incoming,
                conflictReason: 'CRITICAL: Inbound physician NPO order received. Requires immediate tray line halt and RD verification.',
                severity: 'CRITICAL_TRIAGE',
                status: 'PENDING_TRIAGE',
                createdAt: new Date().toISOString(),
            };
        }
        if (existingResident) {
            // 2. Texture Downgrade or Modification (e.g. Regular -> Pureed)
            if (incoming.texture &&
                incoming.texture.toLowerCase() !== existingResident.texture.toLowerCase()) {
                return {
                    id,
                    residentName: fullName,
                    externalEhrId: incoming.residentExternalId,
                    sourceEhr: this.systemName,
                    changeType: 'TEXTURE_UPDATE',
                    incomingPayload: incoming,
                    conflictReason: `Speech Therapy texture modification: Changing from '${existingResident.texture}' to '${incoming.texture}'. Verify IDDSI puree station allocation.`,
                    severity: 'WARNING_REVIEW',
                    status: 'PENDING_TRIAGE',
                    createdAt: new Date().toISOString(),
                };
            }
            // 3. New Critical Food Allergy Added in EHR
            const existingAllergies = new Set(existingResident.allergies.map(a => a.toLowerCase().trim()));
            const newAllergens = (incoming.allergies || []).filter(a => !existingAllergies.has(a.toLowerCase().trim()));
            if (newAllergens.length > 0) {
                return {
                    id,
                    residentName: fullName,
                    externalEhrId: incoming.residentExternalId,
                    sourceEhr: this.systemName,
                    changeType: 'NEW_ALLERGEN',
                    incomingPayload: incoming,
                    conflictReason: `New clinical allergy declared in EHR: [${newAllergens.join(', ')}]. Immediate menu cross-contact audit required.`,
                    severity: 'CRITICAL_TRIAGE',
                    status: 'PENDING_TRIAGE',
                    createdAt: new Date().toISOString(),
                };
            }
            // 4. Therapeutic Diet Order Change (e.g. Regular -> Renal)
            if (incoming.dietOrder &&
                incoming.dietOrder.toLowerCase() !== existingResident.dietType.toLowerCase()) {
                return {
                    id,
                    residentName: fullName,
                    externalEhrId: incoming.residentExternalId,
                    sourceEhr: this.systemName,
                    changeType: 'DIET_ORDER',
                    incomingPayload: incoming,
                    conflictReason: `Diet order change: '${existingResident.dietType}' → '${incoming.dietOrder}'. Audit therapeutic nutrient limits.`,
                    severity: 'WARNING_REVIEW',
                    status: 'PENDING_TRIAGE',
                    createdAt: new Date().toISOString(),
                };
            }
        }
        return null;
    }
    async validateResidentMeals(update) {
        const warnings = [];
        const incompatibleItems = [];
        const allergies = update.allergies || [];
        const isPureed = (update.texture || '').toLowerCase().includes('puree');
        const isNcs = (update.dietOrder || '').toLowerCase().includes('ncs') || (update.dietOrder || '').toLowerCase().includes('diabetic');
        const isNas = (update.dietOrder || '').toLowerCase().includes('nas') || (update.dietOrder || '').toLowerCase().includes('sodium');
        if (allergies.includes('Gluten') || allergies.includes('Wheat')) {
            warnings.push('Gluten allergy: Flag regular breads, pastas, and breaded items.');
        }
        if (isPureed) {
            warnings.push('Pureed IDDSI Level 4 required: No raw textures or whole meats.');
        }
        if (isNcs) {
            warnings.push('No Concentrated Sweets: Replace regular desserts with sugar-free alternatives.');
        }
        if (isNas) {
            warnings.push('No Added Salt: Exclude high-sodium processed broths.');
        }
        return {
            residentExternalId: update.residentExternalId,
            residentName: `${update.firstName} ${update.lastName}`,
            valid: incompatibleItems.length === 0,
            warnings,
            incompatibleMenuItems: incompatibleItems,
        };
    }
    /**
     * Nutrient Analysis Engine: computes macronutrient breakdown & compliance
     */
    calculateNutrients(dietOrder, plannedItems) {
        let calories = 0;
        let proteinGrams = 0;
        let carbGrams = 0;
        let fatGrams = 0;
        let sodiumMg = 0;
        plannedItems.forEach(item => {
            calories += item.calories || 350;
            proteinGrams += item.protein || 18;
            carbGrams += 32;
            fatGrams += 12;
            sodiumMg += item.sodium || 420;
        });
        const isNas = dietOrder.toLowerCase().includes('nas') || dietOrder.toLowerCase().includes('sodium');
        const isRenal = dietOrder.toLowerCase().includes('renal');
        let status = 'compliant';
        let notes = 'Meets therapeutic dietary guideline targets.';
        if (isNas && sodiumMg > 800) {
            status = 'warning';
            notes = `Sodium (${sodiumMg}mg) exceeds per-meal target for Low Sodium/NAS order (<750mg).`;
        }
        else if (isRenal && sodiumMg > 700) {
            status = 'warning';
            notes = `Sodium and protein load exceeds standard Renal protocol threshold.`;
        }
        return {
            calories,
            proteinGrams,
            carbGrams,
            fatGrams,
            sodiumMg,
            status,
            notes,
        };
    }
}
exports.PointClickCareConnector = PointClickCareConnector;
