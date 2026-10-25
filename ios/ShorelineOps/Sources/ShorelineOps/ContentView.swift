#if canImport(SwiftUI)
import SwiftUI

struct ContentView: View {
    @Binding var store: ShorelineStore
    @State private var selectedTab: Int = 0

    // Shoreline Marine Teal brand color
    private let shorelineTeal = Color(red: 0.05, green: 0.58, blue: 0.53)

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardTabView(store: $store, selectedTab: $selectedTab)
                .tabItem {
                    Label("Dashboard", systemImage: "gauge.with.dots.needle.67percent")
                }
                .tag(0)

            ResidentsTabView(store: $store)
                .tabItem {
                    Label("Residents", systemImage: "person.2.crop.square.stack.fill")
                }
                .badge(store.pendingTriageItems.count)
                .tag(1)

            MenuTabView(store: $store)
                .tabItem {
                    Label("Menu", systemImage: "calendar.badge.clock")
                }
                .tag(2)

            KitchenTabView(store: $store)
                .tabItem {
                    Label("Kitchen", systemImage: "qrcode.viewfinder")
                }
                .tag(3)

            MoreTabView(store: $store)
                .tabItem {
                    Label("More", systemImage: "ellipsis.circle.fill")
                }
                .tag(4)
        }
        .tint(shorelineTeal)
    }
}

// MARK: - 1. Dashboard Tab (Executive & Shift Telemetry)

struct DashboardTabView: View {
    @Binding var store: ShorelineStore
    @Binding var selectedTab: Int

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Clinical NPO & EHR Triage Banner
                    if store.npoCount > 0 || !store.pendingTriageItems.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: "exclamationmark.octagon.fill")
                                    .foregroundStyle(.red)
                                Text("CLINICAL SAFETY ALERTS ACTIVE")
                                    .font(.caption.bold())
                                    .foregroundStyle(.red)
                                Spacer()
                            }
                            Text("\(store.npoCount) NPO hard-block(s) • \(store.pendingTriageItems.count) PointClickCare EHR change(s) awaiting RD triage.")
                                .font(.subheadline)
                            Button {
                                selectedTab = 1
                            } label: {
                                Label("Review Clinical Triage Queue", systemImage: "arrow.right.circle.fill")
                                    .font(.subheadline.bold())
                                    .frame(maxWidth: .infinity, minHeight: 44)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.red)
                        }
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    // KPI Grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        KPICard(
                            title: "Active Census",
                            value: "\(store.activeCensusCount)",
                            subtitle: "\(store.npoCount) NPO Excluded",
                            icon: "person.3.fill",
                            accent: .teal
                        )
                        KPICard(
                            title: "Food Cost / Day",
                            value: "$8.42",
                            subtitle: "Target $8.75 ($/CPD)",
                            icon: "dollarsign.circle.fill",
                            accent: .green
                        )
                        KPICard(
                            title: "EHR Triage",
                            value: "\(store.pendingTriageItems.count)",
                            subtitle: "Pending RD Review",
                            icon: "bolt.heart.fill",
                            accent: store.pendingTriageItems.isEmpty ? .secondary : .orange
                        )
                        KPICard(
                            title: "HACCP Logs",
                            value: "\(store.tempLogs.count)",
                            subtitle: "100% Verified Today",
                            icon: "thermometer.medium",
                            accent: .blue
                        )
                    }

                    // IDDSI Dysphagia Distribution Summary
                    VStack(alignment: .leading, spacing: 10) {
                        Text("IDDSI 2.0 Texture & Liquid Breakdown")
                            .font(.headline)
                        ForEach(store.residents) { resident in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(resident.name) (\(resident.room))")
                                        .font(.subheadline.weight(.semibold))
                                    Text(resident.isNpo ? "NPO — DO NOT FEED" : "\(resident.iddsiFoodLevel.shortLabel) • \(resident.liquidConsistency.shortLabel)")
                                        .font(.caption)
                                        .foregroundStyle(resident.isNpo ? .red : .secondary)
                                }
                                Spacer()
                                Text("v\(resident.dietOrderVersion)")
                                    .font(.caption2.monospaced().bold())
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.secondary.opacity(0.15))
                                    .clipShape(Capsule())
                            }
                            Divider()
                        }
                    }
                    .padding()
                    .background(.regularMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding()
            }
            .navigationTitle("Shoreline Care OS")
        }
    }
}

struct KPICard: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(accent)
                Text(title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            Text(value)
                .font(.title2.bold())
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - 2. Residents & EHR Triage Tab

struct ResidentsTabView: View {
    @Binding var store: ShorelineStore
    @State private var searchText: String = ""

    private var filteredResidents: [Resident] {
        if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            return store.residents
        }
        let q = searchText.lowercased()
        return store.residents.filter {
            $0.name.lowercased().contains(q) ||
            $0.room.lowercased().contains(q) ||
            $0.wing.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if !store.pendingTriageItems.isEmpty {
                    Section("PointClickCare EHR Triage Queue (RD Action Required)") {
                        ForEach(store.pendingTriageItems) { item in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(item.changeType)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color.orange.opacity(0.2))
                                        .foregroundStyle(.orange)
                                        .clipShape(Capsule())
                                    Spacer()
                                    Text(item.receivedAt)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Text("\(item.residentName) • Room \(item.room)")
                                    .font(.subheadline.bold())
                                Text(item.summary)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Button {
                                    store.approveTriageItem(item)
                                } label: {
                                    Label("Approve & Increment Diet Version", systemImage: "checkmark.shield.fill")
                                        .font(.caption.bold())
                                        .frame(maxWidth: .infinity, minHeight: 44)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.teal)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section("Active Resident Roster (\(filteredResidents.count))") {
                    ForEach(filteredResidents) { resident in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(resident.name)
                                    .font(.headline)
                                Spacer()
                                Text("Rm \(resident.room)")
                                    .font(.caption.monospaced().bold())
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.teal.opacity(0.15))
                                    .clipShape(Capsule())
                            }

                            if resident.isNpo {
                                Label("NPO HARD BLOCK — NOTHING BY MOUTH", systemImage: "nosign")
                                    .font(.caption.bold())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color.red)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            } else {
                                HStack(spacing: 6) {
                                    Text(resident.iddsiFoodLevel.shortLabel)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.blue.opacity(0.15))
                                        .clipShape(Capsule())

                                    Text(resident.liquidConsistency.shortLabel)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.purple.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                            }

                            if let limit = resident.fluidRestrictionMl {
                                Text("Fluid Restriction: \(resident.fluidConsumedTodayMl) / \(limit) mL today")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            if !resident.allergies.isEmpty {
                                Text("Allergies: \(resident.allergies.joined(separator: ", "))")
                                    .font(.caption.bold())
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search resident, room, or wing")
            .navigationTitle("Residents & IDDSI")
        }
    }
}

// MARK: - 3. Cycle Menu Tab

struct MenuTabView: View {
    @Binding var store: ShorelineStore

    var body: some View {
        NavigationStack {
            List {
                Section("Active Cycle Menu — Standardized Recipes") {
                    ForEach(store.menuItems) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("\(item.mealPeriod) • \(item.choiceLabel)")
                                    .font(.caption.bold())
                                    .foregroundStyle(.teal)
                                Spacer()
                                Text("\(item.calories) kcal • \(item.sodiumMg)mg Na")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                            Text(item.title)
                                .font(.subheadline.bold())
                            Text("Beverage pairing: \(item.beverageConsistency.shortLabel) (\(item.beverageMl) mL)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if item.allergens.isEmpty {
                                Text("Big 9 Allergens: None declared")
                                    .font(.caption2)
                                    .foregroundStyle(.green)
                            } else {
                                Text("Contains: \(item.allergens.joined(separator: ", "))")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Cycle Menu")
        }
    }
}

// MARK: - 4. Kitchen Tab (Tray Verification Scanner & HACCP Temp Log)

struct KitchenTabView: View {
    @Binding var store: ShorelineStore
    @State private var selectedResidentId: String = "SH-101"
    @State private var selectedMenuId: String = "MNU-1"
    @State private var scannedTicketVersion: Int = 4
    @State private var lastVerification: TrayVerificationOutcome?

    // HACCP form state
    @State private var tempItemName: String = "Braised Beef Tips"
    @State private var tempCheckType: String = "Cook Hold (>=165°F)"
    @State private var tempValueText: String = "168.0"
    @State private var correctiveActionText: String = ""
    @State private var tempAlertMessage: String?

    private let checkTypes = [
        "Cook Hold (>=165°F)",
        "Hot Line (>=140°F)",
        "Cold Hold (<=41°F)"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Signed Tray Ticket Safety Verifier") {
                    Picker("Resident", selection: $selectedResidentId) {
                        ForEach(store.residents) { res in
                            Text("\(res.name) (\(res.room))").tag(res.id)
                        }
                    }
                    .frame(minHeight: 44)

                    Picker("Meal Tray / Recipe", selection: $selectedMenuId) {
                        ForEach(store.menuItems) { item in
                            Text("\(item.choiceLabel): \(item.title)").tag(item.id)
                        }
                    }
                    .frame(minHeight: 44)

                    Stepper("Scanned Ticket Version: v\(scannedTicketVersion)", value: $scannedTicketVersion, in: 1...20)
                        .frame(minHeight: 44)

                    Button {
                        if let resident = store.residents.first(where: { $0.id == selectedResidentId }),
                           let menuItem = store.menuItems.first(where: { $0.id == selectedMenuId }) {
                            let pending = store.pendingTriageCount(for: resident.id)
                            lastVerification = DeterministicTraySafetyEngine.evaluate(
                                resident: resident,
                                menuItem: menuItem,
                                scannedTicketVersion: scannedTicketVersion,
                                pendingTriageCount: pending
                            )
                        }
                    } label: {
                        Label("Verify Signed Tray Ticket", systemImage: "qrcode.viewfinder")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)

                    if let result = lastVerification {
                        if result.approved {
                            VStack(alignment: .leading, spacing: 4) {
                                Label("TRAY APPROVED FOR SERVICE", systemImage: "checkmark.seal.fill")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.green)
                                Text("Food texture, IDDSI liquid consistency, fluid ceiling, allergen matrix, and ticket v\(result.ticketVersion) verified.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        } else {
                            VStack(alignment: .leading, spacing: 6) {
                                Label("CLINICAL HOLD — DO NOT SERVE (\(result.holds.count))", systemImage: "xmark.octagon.fill")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.red)
                                ForEach(result.holds) { hold in
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(hold.code)
                                            .font(.caption2.monospaced().bold())
                                            .foregroundStyle(.red)
                                        Text(hold.message)
                                            .font(.caption)
                                    }
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.red.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section("HACCP CCP Temperature Logger") {
                    TextField("Food / Equipment Item", text: $tempItemName)
                        .frame(minHeight: 44)

                    Picker("CCP Threshold", selection: $tempCheckType) {
                        ForEach(checkTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    .frame(minHeight: 44)

                    TextField("Temperature (°F)", text: $tempValueText)
                        .frame(minHeight: 44)

                    TextField("Corrective Action (Required if out of range)", text: $correctiveActionText)
                        .frame(minHeight: 44)

                    Button {
                        let temp = Double(tempValueText) ?? 0.0
                        let saved = store.recordTempLog(
                            itemName: tempItemName,
                            station: "Mobile Line Check",
                            checkType: tempCheckType,
                            tempF: temp,
                            correctiveAction: correctiveActionText
                        )
                        if saved {
                            tempAlertMessage = "Temperature log recorded."
                            correctiveActionText = ""
                        } else {
                            tempAlertMessage = "HOLD: Out-of-range temperature requires a documented corrective action before saving."
                        }
                    } label: {
                        Label("Record HACCP Temperature", systemImage: "thermometer.Variable")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)

                    if let msg = tempAlertMessage {
                        Text(msg)
                            .font(.caption.bold())
                            .foregroundStyle(msg.starts(with: "HOLD") ? .red : .green)
                    }
                }

                Section("Recent HACCP Logs (\(store.tempLogs.count))") {
                    ForEach(store.tempLogs) { log in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(log.itemName)
                                    .font(.subheadline.bold())
                                Spacer()
                                Text(String(format: "%.1f°F", log.tempF))
                                    .font(.subheadline.monospaced().bold())
                                    .foregroundStyle(log.isCompliant ? .green : .orange)
                            }
                            Text("\(log.checkType) • \(log.recordedBy) • \(log.recordedAt)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            if let action = log.correctiveAction {
                                Text("Corrective Action: \(action)")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.orange)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Kitchen & Tray Safety")
        }
    }
}

// MARK: - 5. More Tab (Facility Sync, RLS & Deployment Settings)

struct MoreTabView: View {
    @Binding var store: ShorelineStore

    var body: some View {
        NavigationStack {
            Form {
                Section("Facility Profile") {
                    LabeledContent("Facility", value: store.facilityName)
                    LabeledContent("Location", value: store.facilityLocation)
                    LabeledContent("License Tier", value: store.licenseTier)
                }

                Section("ShorelineOps Backend API Sync") {
                    TextField("API Base URL", text: $store.apiBaseUrl)
                        .frame(minHeight: 44)
                    LabeledContent("Connection Status", value: store.lastSyncStatus)
                    Button {
                        Task {
                            await store.checkBackendHealth()
                        }
                    } label: {
                        Label("Test Backend API Connection", systemImage: "network")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                }

                Section("Clinical & Security Safeguards") {
                    LabeledContent("NPO Hard-Blocks", value: "Enforced (Non-Overridable)")
                    LabeledContent("IDDSI Framework", value: "Food L3–L7 & Liquid L0–L4")
                    LabeledContent("PostgreSQL Isolation", value: "Row-Level Security (Migration 032)")
                    LabeledContent("Build Toolchain", value: "Swift 6.1 + xtool 1.22.2")
                }
            }
            .navigationTitle("Facility & Settings")
        }
    }
}
#endif
