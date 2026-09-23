"use strict";
/**
 * Facility request context middleware.
 * Shoreline Care OS v6.2
 *
 * Extracts the authenticated facility context. This context scopes routes that
 * explicitly query by facility; it is not a substitute for database RLS.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContextMiddleware = tenantContextMiddleware;
const requireAuth_1 = require("./requireAuth");
function tenantContextMiddleware(req, res, next) {
    // Clinical tables are not uniformly facility-scoped. This release supports
    // one facility per database: a header or platform role must not switch its
    // clinical data context. This boundary does not migrate a mixed database.
    const deploymentFacilityId = process.env.SHORELINE_FACILITY_ID?.trim() || 'default';
    let resolvedFacilityId = deploymentFacilityId;
    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
        try {
            const claims = (0, requireAuth_1.verifyAccessToken)(authorization.slice(7));
            if (claims.facilityId !== deploymentFacilityId) {
                return res.status(403).json({ error: 'This account belongs to a different facility deployment', code: 'FACILITY_SCOPE_MISMATCH' });
            }
            resolvedFacilityId = claims.facilityId;
        }
        catch {
            // Authentication middleware returns the authoritative 401 later.
        }
    }
    const requestedFacility = req.headers['x-facility-id'];
    if (requestedFacility !== undefined && requestedFacility !== deploymentFacilityId) {
        return res.status(403).json({ error: 'Facility switching is not supported by this deployment', code: 'FACILITY_SWITCH_DISABLED' });
    }
    req.facilityId = resolvedFacilityId;
    req.corporateGroupId = 'shorelineops';
    // Attach facility context to the response for diagnostics.
    res.setHeader('X-Facility-Context', resolvedFacilityId);
    next();
}
