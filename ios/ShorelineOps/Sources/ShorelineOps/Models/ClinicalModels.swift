import Foundation

// MARK: - IDDSI 2.0 Food Texture & Liquid Consistency Standards

public enum IDDSIFoodLevel: Int, Codable, CaseIterable, Sendable, Identifiable {
    case unassigned = -1
    case liquidised = 3
    case pureed = 4
    case mincedAndMoist = 5
    case softAndBiteSized = 6
    case regular = 7

    public var id: Int { rawValue }

    public var shortLabel: String {
        switch self {
        case .unassigned: return "HOLD (-1) Unassigned"
        case .liquidised: return "L3 Liquidised"
        case .pureed: return "L4 Pureed"
        case .mincedAndMoist: return "L5 Minced & Moist"
        case .softAndBiteSized: return "L6 Soft & Bite-Sized"
        case .regular: return "L7 Regular"
        }
    }
}

public enum IDDSILiquidLevel: Int, Codable, CaseIterable, Sendable, Identifiable {
    case thin = 0
    case slightlyThick = 1
    case mildlyThick = 2
    case moderatelyThick = 3
    case extremelyThick = 4

    public var id: Int { rawValue }

    public var shortLabel: String {
        switch self {
        case .thin: return "L0 Thin"
        case .slightlyThick: return "L1 Slightly Thick"
        case .mildlyThick: return "L2 Mildly Thick"
        case .moderatelyThick: return "L3 Moderately Thick"
        case .extremelyThick: return "L4 Extremely Thick"
        }
    }
}

// MARK: - Clinical Resident Model

public struct Resident: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public var name: String
    public var room: String
    public var wing: String
    public var dietOrders: [String]
    public var iddsiFoodLevel: IDDSIFoodLevel
    public var liquidConsistency: IDDSILiquidLevel
    public var fluidRestrictionMl: Int?
    public var fluidConsumedTodayMl: Int
    public var allergies: [String]
    public var isNpo: Bool
    public var adaptiveEquipment: [String]
    public var dietOrderVersion: Int
}

// MARK: - PointClickCare EHR Triage Item

public struct EhrTriageItem: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public let residentId: String
    public let residentName: String
    public let room: String
    public let changeType: String
    public let summary: String
    public let proposedFoodLevel: IDDSIFoodLevel?
    public let proposedLiquidLevel: IDDSILiquidLevel?
    public let proposedNpo: Bool?
    public let proposedAllergen: String?
    public let receivedAt: String
    public var status: String // "PENDING_TRIAGE" | "APPROVED"
}

// MARK: - Cycle Menu & Recipe Spec

public struct MenuSlotItem: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public let mealPeriod: String // "Breakfast" | "Lunch" | "Dinner"
    public let choiceLabel: String // "Choice A" | "Choice B"
    public let title: String
    public let allowedFoodLevels: [IDDSIFoodLevel]
    public let beverageConsistency: IDDSILiquidLevel
    public let beverageMl: Int
    public let allergens: [String]
    public let calories: Int
    public let sodiumMg: Int
}

// MARK: - HACCP Temperature Log

public struct HaccpTempLog: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public let itemName: String
    public let station: String
    public let checkType: String // "Cook Hold (>=165°F)" | "Hot Line (>=140°F)" | "Cold Hold (<=41°F)"
    public let tempF: Double
    public let isCompliant: Bool
    public let correctiveAction: String?
    public let recordedBy: String
    public let recordedAt: String
}

// MARK: - Deterministic Tray Verification Engine

public struct TrayHoldReason: Identifiable, Sendable, Equatable {
    public var id: String { code }
    public let code: String
    public let message: String
}

public struct TrayVerificationOutcome: Sendable, Equatable {
    public let residentName: String
    public let menuItemTitle: String
    public let ticketVersion: Int
    public let currentResidentVersion: Int
    public let approved: Bool
    public let holds: [TrayHoldReason]
}

public enum DeterministicTraySafetyEngine {
    /// Non-overridable clinical tray safety check matching server/src/engine/traySafety.ts
    public static func evaluate(
        resident: Resident,
        menuItem: MenuSlotItem,
        scannedTicketVersion: Int,
        pendingTriageCount: Int
    ) -> TrayVerificationOutcome {
        var holds: [TrayHoldReason] = []

        // 1. NPO Hard Block
        if resident.isNpo {
            holds.append(TrayHoldReason(
                code: "NPO_HARD_BLOCK",
                message: "Resident is NPO (Nothing by Mouth). Oral tray assembly is strictly prohibited."
            ))
        }

        // 2. Unassigned IDDSI Texture Hold
        if resident.iddsiFoodLevel == .unassigned {
            holds.append(TrayHoldReason(
                code: "IDDSI_UNASSIGNED_HOLD",
                message: "Resident IDDSI food texture is unassigned (-1). Confirm with Registered Dietitian."
            ))
        }

        // 3. Pending EHR Triage Hold
        if pendingTriageCount > 0 {
            holds.append(TrayHoldReason(
                code: "PENDING_EHR_RECONCILIATION",
                message: "Unresolved PointClickCare EHR diet change pending RD triage."
            ))
        }

        // 4. Stale Signed Ticket Version Hold
        if scannedTicketVersion != resident.dietOrderVersion {
            holds.append(TrayHoldReason(
                code: "STALE_DIET_ORDER_VERSION",
                message: "Scanned ticket v\(scannedTicketVersion) does not match active clinical order v\(resident.dietOrderVersion). Reprint tray card."
            ))
        }

        // 5. Allergen Intersection Hard Block
        let residentAllergensLower = Set(resident.allergies.map { $0.lowercased() })
        for allergen in menuItem.allergens {
            if residentAllergensLower.contains(allergen.lowercased()) {
                holds.append(TrayHoldReason(
                    code: "ALLERGEN_COLLISION_\(allergen.uppercased())",
                    message: "Recipe contains \(allergen), intersecting with resident allergy (\(resident.allergies.joined(separator: ", ")))."
                ))
            }
        }

        // 6. IDDSI Food Texture Compatibility
        if resident.iddsiFoodLevel != .unassigned && !menuItem.allowedFoodLevels.contains(resident.iddsiFoodLevel) {
            holds.append(TrayHoldReason(
                code: "IDDSI_FOOD_TEXTURE_MISMATCH",
                message: "Dish is not verified for \(resident.iddsiFoodLevel.shortLabel)."
            ))
        }

        // 7. IDDSI Liquid Consistency Mismatch (Levels 0-4)
        if menuItem.beverageConsistency != resident.liquidConsistency {
            holds.append(TrayHoldReason(
                code: "IDDSI_LIQUID_CONSISTENCY_MISMATCH",
                message: "Beverage is \(menuItem.beverageConsistency.shortLabel), but resident requires \(resident.liquidConsistency.shortLabel)."
            ))
        }

        // 8. Daily Fluid Restriction Ceiling Check
        if let limitMl = resident.fluidRestrictionMl,
           resident.fluidConsumedTodayMl + menuItem.beverageMl > limitMl {
            holds.append(TrayHoldReason(
                code: "FLUID_RESTRICTION_EXCEEDED",
                message: "Beverage (\(menuItem.beverageMl) mL) exceeds daily \(limitMl) mL ceiling (\(resident.fluidConsumedTodayMl) mL already recorded)."
            ))
        }

        return TrayVerificationOutcome(
            residentName: resident.name,
            menuItemTitle: menuItem.title,
            ticketVersion: scannedTicketVersion,
            currentResidentVersion: resident.dietOrderVersion,
            approved: holds.isEmpty,
            holds: holds
        )
    }
}
