# ShorelineOps Technical Wiki & Enterprise Documentation

Welcome to the official technical wiki for **ShorelineOps** — the open-source dietary operations, safety, and supply chain platform engineered for senior living communities (Assisted Living, Memory Care, and Skilled Nursing Facilities).

---

## Table of Contents

1. [System Architecture](Architecture.md) — High-level design, database schema, and micro-engine pipelines.
2. [Deterministic Clinical Safety Engine](SafetyEngine.md) — Multi-tier safety evaluator, IDDSI checks, and nutrient ceiling hard-blocks.
3. [Digital QR Tray Line Scanner](QRTrayScanner.md) — Real-time tray card verification, diet-order supersession detection, and audio/haptic feedback.
4. [Multi-Distributor Split MRP Engine](MRPSplitEngine.md) — Cross-vendor SKU price benchmarking, lead-time optimization, and automated PO generation.
5. [Three-Way Invoice Matching Engine](InvoicingEngine.md) — Automated PO, delivery receipt, and vendor invoice reconciliation with credit memo generation.
6. [CMS-2567 Survey Audit Binder](CMSSurveyEngine.md) — Automated F-Tag evaluation (F800-F812), HACCP temperature log verification, and inspection export.
7. [PointClickCare EHR Reconciliation Queue](PointClickCareQueue.md) — Inbound diet change triage queue, RD approvals, and audit trail.
8. [Apple UI Design System Integration](AppleUIDesign.md) — Human Interface Guidelines (HIG) tokens, fluid animations, and Cupertino components.
9. [Render Cloud Deployment Guide](RenderDeployment.md) — 1-Click multi-service Blueprint setup for the API, React Demo PWA, Astro Marketing, and PostgreSQL.
10. [Vercel Deployment Guide](VercelDeployment.md) — Multi-project setup for static edge hosting.

---

## Quick Navigation & Highlights

| Subsystem | Primary Engine / Component | Key Capability |
|---|---|---|
| **Clinical Safety** | `SafetyEvaluatorEngine` | Hard-blocks NPO violations, allergen intersections, and IDDSI texture mismatches. |
| **Tray Delivery** | `TrayAssemblyScanner` | Verifies cryptographic QR tokens; halts delivery if a physician alters a diet order during meal prep. |
| **Purchasing / MRP** | `MrpDemandForecastEngine` | Evaluates Dennis vs. Sysco vs. US Foods quotes and splits orders to minimize $/gram. |
| **Financial Audit** | `ThreeWayInvoiceMatchingEngine` | Catches overcharges and short deliveries; outputs formatted credit memo dispute sheets. |
| **State Inspection** | `CmsSurveyEngine` | Evaluates 90-day HACCP logs, meal spacing (F809), and generates one-click CMS-2567 survey binders. |
| **EHR Interop** | `PointClickCareConnector` | Queues external EHR order updates in a dedicated RD triage workstation. |
| **Design System** | `src/apple-ui/` | Apple Human Interface Guidelines design tokens, vibrant glass cards, and tactile buttons. |
