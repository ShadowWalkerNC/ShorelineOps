# ShorelineOps Hardware Integration Guide — v6.0

> Direct thermal tray card printers + Bluetooth HACCP temperature probes.

---

## Thermal Tray Card Printers

ShorelineOps generates printer-agnostic `ThermalPrintJob` JSON payloads (label zones) that can be transmitted to any ZPL, StarPRNT, or custom driver bridge. Each label is 4×6 in (101.6×152.4 mm).

### Supported Models

| Printer | Protocol | Connection |
|---|---|---|
| Zebra ZD421 | ZPL II | Ethernet / USB / Bluetooth |
| Zebra ZD620 | ZPL II | Ethernet / USB |
| Zebra ZQ521 | ZPL II | Bluetooth |
| Brother QL-1110NWB | QL Raster | Wi-Fi / Bluetooth |
| Star TSP743II | StarPRNT | Ethernet |

### API Routes

```
POST   /api/hardware/print/tray-card    Generate a 4x6 thermal tray card print job
GET    /api/hardware/printers           List registered thermal printers
```

**Request body for `print/tray-card`:**
```json
{
  "id": "SH-001",
  "name": "Eleanor Vance",
  "room": "104-A",
  "wing": "Ocean Wing",
  "diet": "Pureed (L4)",
  "texture": "IDDSI Level 4 Pureed",
  "fluids": "Mildly Thick (L2)",
  "allergies": ["Shellfish", "Penicillin"],
  "mealDate": "2026-09-02",
  "mealType": "Lunch"
}
```

### CLI

```bash
shoreline hardware printers
shoreline hardware print-tray --resident-id=SH-001
shoreline hardware print-tray --resident-id=SH-001 --json
```

---

## Bluetooth HACCP Temperature Probes

ShorelineOps manages Bluetooth LE HACCP probes via an HTTP polling model (v6.0). All readings are logged to the HACCP audit trail and fire webhook events on violations.

### Supported Models

| Probe | Protocol | Temp Range |
|---|---|---|
| ThermoWorks Signals BT | BLE / Wi-Fi | -58°F to 572°F |
| Inkbird IBT-4XS | BLE | -22°F to 572°F |
| Govee H5074 | BLE | -4°F to 158°F |

### API Routes

```
GET    /api/hardware/probes                          List all discovered probes
GET    /api/hardware/probes/:probeId/temperature     Read current temperature
POST   /api/hardware/probes/:probeId/log-haccp       Log HACCP entry (fires webhook on violation)
```

**Request body for `log-haccp`:**
```json
{ "stationId": "STEAM-TABLE-1", "itemName": "Herb Roasted Turkey", "loggedBy": "cook-01" }
```

### CLI

```bash
shoreline hardware probes
shoreline hardware probe-temp --probe-id=PROBE-001
shoreline hardware probe-temp --probe-id=PROBE-003 --json
```

### Temperature Safety Thresholds

| Type | Threshold | Corrective Action |
|---|---|---|
| Hot Hold | >= 140°F required | Reheat to 165°F / Rapid Chill / Discard |
| Cold Hold | <= 41°F required | Discard or rapid chill |
| Cook — Poultry | >= 165°F required | Re-cook or discard |

---

## Webhook Events on Violations

HACCP violations automatically fire a `haccp.temp.violation` webhook event to all registered subscribers. See [`docs/WEBHOOKS.md`](WEBHOOKS.md) for the payload schema and HMAC verification guide.

---

## v6.0 Hardware Roadmap

- [ ] Real BLE device scanning via `noble` npm package
- [ ] ZPL II direct rendering for Zebra label printers
- [ ] Brother QL raster driver bridge
- [ ] Wireless Kitchen Display System (KDS) integration
- [ ] Bluetooth probe pairing management UI in settings