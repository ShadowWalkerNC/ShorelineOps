import Testing
@testable import ShorelineOps

@Suite("ShorelineOps iOS Clinical Safety & HACCP Tests")
struct ClinicalSafetyTests {

    @Test("NPO resident triggers non-overridable NPO_HARD_BLOCK")
    func testNpoHardBlock() {
        let npoResident = Resident(
            id: "SH-102",
            name: "Arthur Pendelton",
            room: "112-B",
            wing: "Back Cove",
            dietOrders: ["NPO"],
            iddsiFoodLevel: .unassigned,
            liquidConsistency: .moderatelyThick,
            fluidRestrictionMl: nil,
            fluidConsumedTodayMl: 0,
            allergies: ["Dairy"],
            isNpo: true,
            adaptiveEquipment: [],
            dietOrderVersion: 2
        )

        let menuItem = MenuSlotItem(
            id: "MNU-1",
            mealPeriod: "Lunch",
            choiceLabel: "Choice A",
            title: "Herb-Roasted Turkey Puree",
            allowedFoodLevels: [.pureed],
            beverageConsistency: .moderatelyThick,
            beverageMl: 120,
            allergens: [],
            calories: 540,
            sodiumMg: 480
        )

        let outcome = DeterministicTraySafetyEngine.evaluate(
            resident: npoResident,
            menuItem: menuItem,
            scannedTicketVersion: 2,
            pendingTriageCount: 0
        )

        #expect(!outcome.approved)
        #expect(outcome.holds.contains(where: { $0.code == "NPO_HARD_BLOCK" }))
        #expect(outcome.holds.contains(where: { $0.code == "IDDSI_UNASSIGNED_HOLD" }))
    }

    @Test("IDDSI liquid consistency mismatch triggers IDDSI_LIQUID_CONSISTENCY_MISMATCH")
    func testLiquidConsistencyMismatch() {
        let resident = Resident(
            id: "SH-101",
            name: "Eleanor Vance",
            room: "204-A",
            wing: "Casco Bay",
            dietOrders: ["Dysphagia"],
            iddsiFoodLevel: .pureed,
            liquidConsistency: .moderatelyThick, // L3 Moderately Thick required
            fluidRestrictionMl: 1500,
            fluidConsumedTodayMl: 600,
            allergies: [],
            isNpo: false,
            adaptiveEquipment: [],
            dietOrderVersion: 5
        )

        let thinDrinkMeal = MenuSlotItem(
            id: "MNU-1",
            mealPeriod: "Lunch",
            choiceLabel: "Choice A",
            title: "Herb-Roasted Turkey Puree with Thin Water",
            allowedFoodLevels: [.pureed],
            beverageConsistency: .thin, // L0 Thin served!
            beverageMl: 240,
            allergens: [],
            calories: 540,
            sodiumMg: 480
        )

        let outcome = DeterministicTraySafetyEngine.evaluate(
            resident: resident,
            menuItem: thinDrinkMeal,
            scannedTicketVersion: 5,
            pendingTriageCount: 0
        )

        #expect(!outcome.approved)
        #expect(outcome.holds.contains(where: { $0.code == "IDDSI_LIQUID_CONSISTENCY_MISMATCH" }))
    }

    @Test("Allergen intersection and stale ticket version hold tray")
    func testAllergenAndStaleVersionHold() {
        let resident = Resident(
            id: "SH-105",
            name: "Dorothy Winslow",
            room: "105-A",
            wing: "Back Cove",
            dietOrders: ["Regular"],
            iddsiFoodLevel: .regular,
            liquidConsistency: .thin,
            fluidRestrictionMl: nil,
            fluidConsumedTodayMl: 500,
            allergies: ["Sesame"],
            isNpo: false,
            adaptiveEquipment: [],
            dietOrderVersion: 3
        )

        let sesameMeal = MenuSlotItem(
            id: "MNU-4",
            mealPeriod: "Dinner",
            choiceLabel: "Choice B",
            title: "Sesame Ginger Tofu",
            allowedFoodLevels: [.regular],
            beverageConsistency: .thin,
            beverageMl: 240,
            allergens: ["Soy", "Sesame"],
            calories: 510,
            sodiumMg: 590
        )

        let outcome = DeterministicTraySafetyEngine.evaluate(
            resident: resident,
            menuItem: sesameMeal,
            scannedTicketVersion: 2, // Stale ticket v2 vs active v3
            pendingTriageCount: 0
        )

        #expect(!outcome.approved)
        #expect(outcome.holds.contains(where: { $0.code == "STALE_DIET_ORDER_VERSION" }))
        #expect(outcome.holds.contains(where: { $0.code == "ALLERGEN_COLLISION_SESAME" }))
    }

    @Test("EHR triage approval atomically increments dietOrderVersion and HACCP enforces corrective action")
    func testStoreTriageAndHaccp() {
        var store = ShorelineStore()
        let initialVersion = store.residents.first(where: { $0.id == "SH-101" })?.dietOrderVersion ?? 0
        if let firstTriage = store.pendingTriageItems.first(where: { $0.residentId == "SH-101" }) {
            store.approveTriageItem(firstTriage)
        }
        let updatedResident = store.residents.first(where: { $0.id == "SH-101" })
        #expect(updatedResident?.dietOrderVersion == initialVersion + 1)
        #expect(updatedResident?.liquidConsistency == .moderatelyThick)

        // Out-of-range cook temp (148°F < 165°F) without corrective action must be rejected
        let rejected = store.recordTempLog(
            itemName: "Roast Chicken",
            station: "Line 1",
            checkType: "Cook Hold (>=165°F)",
            tempF: 148.0,
            correctiveAction: ""
        )
        #expect(!rejected)

        // With corrective action, log is accepted
        let accepted = store.recordTempLog(
            itemName: "Roast Chicken",
            station: "Line 1",
            checkType: "Cook Hold (>=165°F)",
            tempF: 148.0,
            correctiveAction: "Returned to combi-oven to reach 168°F for 15s"
        )
        #expect(accepted)
    }
}
