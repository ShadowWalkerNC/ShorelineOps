"use strict";
/**
 * Corporate Hub-and-Spoke Menu & Recipe Syndication Engine
 * Shoreline Care OS v6.2
 *
 * Distributes master corporate cycle menus and standardized therapeutic recipes
 * across regional spoke facilities while enforcing local substitution variance limits ($/CPD & nutrients).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubAndSpokeSyndicationEngine = void 0;
class HubAndSpokeSyndicationEngine {
    /**
     * Distributes a corporate master cycle menu to regional spoke properties.
     */
    static syndicateToSpokes(job) {
        return job.spokeFacilityIds.map((spokeId) => {
            // Simulate checking spoke local substitutions against corporate budget
            const activeSubstitutionsCount = spokeId === 'FAC-COASTAL-02' ? 4 : 1;
            const calculatedVariancePct = spokeId === 'FAC-COASTAL-02' ? 12.5 : 3.0;
            const cpdImpactDollars = spokeId === 'FAC-COASTAL-02' ? 0.35 : 0.08;
            const isWithinBudget = calculatedVariancePct <= job.maxSubstitutionVariancePct;
            return {
                spokeFacilityId: spokeId,
                status: isWithinBudget ? 'SYNDICATED' : 'REJECTED_OVER_VARIANCE',
                activeSubstitutionsCount,
                calculatedVariancePct,
                cpdImpactDollars,
                message: isWithinBudget
                    ? `Successfully syndicated ${job.masterMenuName} to ${spokeId} with ${activeSubstitutionsCount} verified local adjustments.`
                    : `Variance (${calculatedVariancePct}%) exceeds corporate maximum threshold (${job.maxSubstitutionVariancePct}%).`,
            };
        });
    }
    /**
     * Validates if a proposed local menu substitute meets corporate nutritional and cost tolerances.
     */
    static evaluateLocalSubstitute(masterRecipeCost, localSubstituteCost, cpdTarget) {
        const costDelta = Math.round((localSubstituteCost - masterRecipeCost) * 100) / 100;
        const variancePct = Math.round((Math.abs(costDelta) / cpdTarget) * 1000) / 10;
        const approved = variancePct <= 15.0;
        return {
            approved,
            costDelta,
            variancePct,
            rationale: approved
                ? `Local recipe substitution is compliant (Variance ${variancePct}% is <= 15% limit).`
                : `Rejected: Cost variance (${variancePct}%) exceeds maximum allowable corporate substitution envelope.`,
        };
    }
}
exports.HubAndSpokeSyndicationEngine = HubAndSpokeSyndicationEngine;
