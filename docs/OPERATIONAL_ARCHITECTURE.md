# Operational Architecture & Hardware Integration Specification

## 1. Executive Summary & Grill-Me Decisions

Following the operational deep-dive on the 4 operational gaps, the architecture resolves all deployment requirements across mobile hardware, electronic distributor interchange, nutritional intelligence, and physical printing.

| Domain | Selected Architecture | Operational Guarantee |
|---|---|---|
| **HACCP Temperature Logging** | Manual entry primary default with supervisor badge override + WebBluetooth probe pairing when available (Chromium/Android) | 100% operational on any device (iOS, Android, Windows, Mac); zero kitchen lockout if probe battery or Bluetooth drops. |
| **Distributor EDI Interchange** | Dual Mode: Background SFTP polling worker (ssh2-sftp-client) with local staging directories + auto-fallback to encrypted CSV/PDF email dispatch | Zero order dropouts even if distributor SFTP is offline or awaiting credential issuance. |
| **Nutritional Calculation Engine** | AI-researched hybrid SQLite master nutrient database + lazy-fetch upsert via USDA FoodData Central API when `USDA_API_KEY` is present | Full offline meal planning with comprehensive institutional macro/micronutrient calculations out-of-the-box. |
| **Tray Card & Label Printing** | Multi-Protocol Print Manager: 1) Direct TCP socket (port 9100) to network Zebra/desktop printers, 2) Zebra Browser Print USB/network agent, 3) Native browser 4"x6" print dialog fallback | Supports all desktop & mobile printer topologies (USB thermal, Ethernet/Wi-Fi network printers, standard office printers). |
| **System & Hardware Configuration** | Dual Configuration: Facility Settings UI (with live ping & test print) + `.env` environment variable overrides + CLI setup tools | Turnkey setup for IT admins and accessible day-to-day diagnostic control for kitchen directors. |

---

## 2. Gap Resolution Specifications

### Gap 1: Bluetooth Probe & HACCP Logging Architecture
* **Primary Mode**: Responsive numeric keypad UI on tablet/mobile with instant tactile feedback, upper/lower HACCP warning bands (<165°F cooking hold, <140°F steam line hold, >40°F cold storage hold), and supervisor override badge verification.
* **Secondary Enhancement**: Progressive WebBluetooth discovery for Cooper-Atkins, ThermoWorks BlueTherm, and generic BLE thermometers on supported browsers (Chrome, Edge). If disconnected, the UI seamlessly falls back to manual entry without modal traps.

### Gap 2: EDI SFTP & Order Guide Dispatch Pipeline
* **Background Worker**: Node.js SFTP client (`ssh2-sftp-client`) connects to vendor endpoints (e.g. Dennis Food Service, Sysco), polling inbound directories (`/inbound/invoices/`, `/inbound/catalog/`) and pushing generated EDI 850 PO files to `/outbound/orders/`.
* **Resilient Fallback**: If SFTP host is unreachable or credentials are unconfigured:
  1. Orders are queued locally in `distributor_queue` table with status `QUEUED_OFFLINE`.
  2. Generates an encrypted order bundle (CSV + PDF Purchase Order).
  3. Provides a 1-click "Download Vendor Order Guide" button and automated SMTP dispatch to the facility's vendor sales representative.

### Gap 3: Hybrid Nutritional Intelligence Engine
* **Local Master Database**: Comprehensive pre-seeded nutrient table (`food_nutrients`) covering common institutional culinary ingredients (proteins, dairy, grains, vegetables, pureed binders, therapeutic thickeners, supplements).
* **Lazy Ingestion**: When an ingredient is added with a USDA FDC ID, if `USDA_API_KEY` is configured, the server fetches complete USDA FoodData Central profiles and caches them locally, continuously expanding the facility's offline database.

### Gap 4: Thermal & Desktop Printing Subsystem
* **Direct Network TCP Printing (Port 9100)**: Server-side raw socket client (`net.Socket`) transmits raw ZPL envelopes directly to the thermal printer's LAN IP.
* **Workstation USB / Local Print Relay**: Supports Zebra Browser Print JavaScript API for locally connected USB desktop printers.
* **Universal Browser Dialog (4"x6")**: Pure CSS `@page { size: 4in 6in; margin: 0; }` rendering for standard desktop printers, air-print printers, and PDF batch exporting.

### Gap 5: Hardware & Integrations Configuration Portal
* **Settings Page**: Dedicated UI in `src/features/settings/` displaying:
  * Network Printer IP, Port, and "Send Test Label" diagnostic trigger.
  * Distributor SFTP Host, Port, Username, Key path, and "Test SFTP Connection" diagnostic trigger.
  * USDA API Key status indicator and cache counter.
  * Probe pairing status indicator.
* **Dual Persistence**: Database-first (`facility_settings` table) with environment variable fallback priority (`process.env.PRINTER_IP || dbSettings.printer_ip`).
