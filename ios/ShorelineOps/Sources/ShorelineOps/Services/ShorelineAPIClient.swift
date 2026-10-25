import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct ShorelineStore: Sendable {
    public var apiBaseUrl: String = "http://127.0.0.1:3001/api"
    public var facilityName: String = "Shoreline Healthcare & Rehabilitation"
    public var facilityLocation: String = "Portland, ME"
    public var licenseTier: String = "Enterprise Care Network"
    public var isOnlineConnected: Bool = false
    public var lastSyncStatus: String = "Local Clinical Sandbox (Offline-Ready)"

    public var residents: [Resident] = [
        Resident(
            id: "SH-101",
            name: "Eleanor Vance",
            room: "204-A",
            wing: "Casco Bay Memory Care",
            dietOrders: ["NAS (2g Sodium)", "Dysphagia Mechanical"],
            iddsiFoodLevel: .pureed,
            liquidConsistency: .mildlyThick,
            fluidRestrictionMl: 1500,
            fluidConsumedTodayMl: 1150,
            allergies: ["Shellfish", "Peanuts"],
            isNpo: false,
            adaptiveEquipment: ["Weighted Spoon", "Nosey Cup"],
            dietOrderVersion: 4
        ),
        Resident(
            id: "SH-102",
            name: "Arthur Pendelton",
            room: "112-B",
            wing: "Back Cove Skilled Rehab",
            dietOrders: ["NPO — Speech Therapy Eval Pending"],
            iddsiFoodLevel: .unassigned,
            liquidConsistency: .moderatelyThick,
            fluidRestrictionMl: nil,
            fluidConsumedTodayMl: 0,
            allergies: ["Dairy"],
            isNpo: true,
            adaptiveEquipment: [],
            dietOrderVersion: 2
        ),
        Resident(
            id: "SH-103",
            name: "Margaret Holloway",
            room: "308-A",
            wing: "Munjoy Hill Assisted",
            dietOrders: ["Consistent Carbohydrate (NCS)", "Cardiac"],
            iddsiFoodLevel: .mincedAndMoist,
            liquidConsistency: .thin,
            fluidRestrictionMl: nil,
            fluidConsumedTodayMl: 950,
            allergies: ["Gluten", "Wheat", "Soy"],
            isNpo: false,
            adaptiveEquipment: ["Plate Guard"],
            dietOrderVersion: 3
        ),
        Resident(
            id: "SH-104",
            name: "Walter Lowell",
            room: "210-C",
            wing: "Casco Bay Memory Care",
            dietOrders: ["Renal (Low K+ / Low Phos)", "Fluid Restricted"],
            iddsiFoodLevel: .softAndBiteSized,
            liquidConsistency: .slightlyThick,
            fluidRestrictionMl: 1200,
            fluidConsumedTodayMl: 1050,
            allergies: ["Eggs"],
            isNpo: false,
            adaptiveEquipment: ["High-Rim Plate"],
            dietOrderVersion: 5
        ),
        Resident(
            id: "SH-105",
            name: "Dorothy Winslow",
            room: "105-A",
            wing: "Back Cove Skilled Rehab",
            dietOrders: ["Regular Therapeutic"],
            iddsiFoodLevel: .regular,
            liquidConsistency: .thin,
            fluidRestrictionMl: nil,
            fluidConsumedTodayMl: 1400,
            allergies: ["Sesame"],
            isNpo: false,
            adaptiveEquipment: [],
            dietOrderVersion: 1
        )
    ]

    public var triageQueue: [EhrTriageItem] = [
        EhrTriageItem(
            id: "TRG-901",
            residentId: "SH-101",
            residentName: "Eleanor Vance",
            room: "204-A",
            changeType: "SLP LIQUID DOWNGRADE",
            summary: "SLP bedside swallow eval: downgrade liquids from L2 Mildly Thick to L3 Moderately Thick.",
            proposedFoodLevel: .pureed,
            proposedLiquidLevel: .moderatelyThick,
            proposedNpo: nil,
            proposedAllergen: nil,
            receivedAt: "10 mins ago via PointClickCare",
            status: "PENDING_TRIAGE"
        ),
        EhrTriageItem(
            id: "TRG-902",
            residentId: "SH-103",
            residentName: "Margaret Holloway",
            room: "308-A",
            changeType: "NEW ALLERGY FLAG",
            summary: "Inbound EHR allergy addition: Tree Nuts documented on admission reconciliation.",
            proposedFoodLevel: nil,
            proposedLiquidLevel: nil,
            proposedNpo: nil,
            proposedAllergen: "Tree Nuts",
            receivedAt: "24 mins ago via PointClickCare",
            status: "PENDING_TRIAGE"
        )
    ]

    public var menuItems: [MenuSlotItem] = [
        MenuSlotItem(
            id: "MNU-1",
            mealPeriod: "Lunch",
            choiceLabel: "Choice A",
            title: "Herb-Roasted Turkey Breast & Squash Puree (L4 + L2 Nectar)",
            allowedFoodLevels: [.pureed, .mincedAndMoist, .softAndBiteSized, .regular],
            beverageConsistency: .mildlyThick,
            beverageMl: 240,
            allergens: [],
            calories: 540,
            sodiumMg: 480
        ),
        MenuSlotItem(
            id: "MNU-2",
            mealPeriod: "Lunch",
            choiceLabel: "Choice B",
            title: "New England Baked Haddock with Thin Broth (L6/L7 + L0 Thin)",
            allowedFoodLevels: [.softAndBiteSized, .regular],
            beverageConsistency: .thin,
            beverageMl: 240,
            allergens: ["Fish", "Dairy"],
            calories: 590,
            sodiumMg: 610
        ),
        MenuSlotItem(
            id: "MNU-3",
            mealPeriod: "Dinner",
            choiceLabel: "Choice A",
            title: "Braised Beef Tips over Minced Root Vegetables (L5 + L1 Slightly Thick)",
            allowedFoodLevels: [.mincedAndMoist, .softAndBiteSized, .regular],
            beverageConsistency: .slightlyThick,
            beverageMl: 120,
            allergens: ["Soy"],
            calories: 620,
            sodiumMg: 530
        ),
        MenuSlotItem(
            id: "MNU-4",
            mealPeriod: "Dinner",
            choiceLabel: "Choice B",
            title: "Sesame Ginger Tofu & Steamed Rice (L7 Regular + L0 Thin)",
            allowedFoodLevels: [.regular],
            beverageConsistency: .thin,
            beverageMl: 240,
            allergens: ["Soy", "Sesame", "Wheat", "Gluten"],
            calories: 510,
            sodiumMg: 590
        )
    ]

    public var tempLogs: [HaccpTempLog] = [
        HaccpTempLog(
            id: "TMP-01",
            itemName: "Herb-Roasted Turkey Breast",
            station: "Hot Entree Line 1",
            checkType: "Cook Hold (>=165°F)",
            tempF: 171.5,
            isCompliant: true,
            correctiveAction: nil,
            recordedBy: "Chef M. Vance (BLE Probe #2)",
            recordedAt: "11:15 AM"
        ),
        HaccpTempLog(
            id: "TMP-02",
            itemName: "Walk-In Dairy Cooler #1",
            station: "Cold Storage",
            checkType: "Cold Hold (<=41°F)",
            tempF: 37.8,
            isCompliant: true,
            correctiveAction: nil,
            recordedBy: "Lead Cook J. Miller",
            recordedAt: "06:00 AM"
        )
    ]

    public init() {}

    // MARK: - Computed Operational Telemetry

    public var activeCensusCount: Int { residents.count }
    public var npoCount: Int { residents.filter(\.isNpo).count }
    public var pendingTriageItems: [EhrTriageItem] {
        triageQueue.filter { $0.status == "PENDING_TRIAGE" }
    }

    public func pendingTriageCount(for residentId: String) -> Int {
        triageQueue.filter { $0.residentId == residentId && $0.status == "PENDING_TRIAGE" }.count
    }

    // MARK: - Atomic EHR Reconciliation Action

    public mutating func approveTriageItem(_ item: EhrTriageItem) {
        guard let idx = triageQueue.firstIndex(where: { $0.id == item.id }) else { return }
        if let resIdx = residents.firstIndex(where: { $0.id == item.residentId }) {
            if let food = item.proposedFoodLevel {
                residents[resIdx].iddsiFoodLevel = food
            }
            if let liquid = item.proposedLiquidLevel {
                residents[resIdx].liquidConsistency = liquid
            }
            if let npo = item.proposedNpo {
                residents[resIdx].isNpo = npo
            }
            if let allergen = item.proposedAllergen,
               !residents[resIdx].allergies.contains(allergen) {
                residents[resIdx].allergies.append(allergen)
            }
            // Atomic dietOrderVersion bump on clinical change
            residents[resIdx].dietOrderVersion += 1
        }
        triageQueue[idx].status = "APPROVED"
    }

    // MARK: - Durable HACCP Temperature Logging

    public mutating func recordTempLog(
        itemName: String,
        station: String,
        checkType: String,
        tempF: Double,
        correctiveAction: String?
    ) -> Bool {
        let isCompliant: Bool
        switch checkType {
        case "Cook Hold (>=165°F)":
            isCompliant = tempF >= 165.0
        case "Hot Line (>=140°F)":
            isCompliant = tempF >= 140.0
        default:
            isCompliant = tempF <= 41.0
        }

        // Fail-closed: out-of-range temperature requires a corrective action
        let trimmedAction = correctiveAction?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !isCompliant && trimmedAction.isEmpty {
            return false
        }

        let entry = HaccpTempLog(
            id: "TMP-\(Int.random(in: 100...999))",
            itemName: itemName,
            station: station,
            checkType: checkType,
            tempF: tempF,
            isCompliant: isCompliant,
            correctiveAction: isCompliant ? nil : trimmedAction,
            recordedBy: "Mobile Kiosk Operator",
            recordedAt: "Just now"
        )
        tempLogs.insert(entry, at: 0)
        return true
    }

    // MARK: - Backend Health Probe

    public mutating func checkBackendHealth() async {
        guard let url = URL(string: "\(apiBaseUrl)/health") else {
            isOnlineConnected = false
            lastSyncStatus = "Invalid API URL"
            return
        }
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                isOnlineConnected = true
                lastSyncStatus = "Connected to ShorelineOps API (\(http.statusCode) OK)"
            } else {
                isOnlineConnected = false
                lastSyncStatus = "Server unreachable — running in local offline sandbox"
            }
        } catch {
            isOnlineConnected = false
            lastSyncStatus = "Offline Mode Active (Local SQLite/Sandbox)"
        }
    }
}
