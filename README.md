# Shoreline

**Shoreline Operations Platform** — A secure, internal staff management and care coordination system for Shoreline Operations LLC.

> **Internal use only.** Access is restricted to authorized employees, contractors, and agents of Shoreline Operations LLC.

---

## Overview

Shoreline is a full-stack progressive web application (PWA) built with React, TypeScript, Vite, Supabase, and Tailwind CSS. It is designed to support daily facility operations including resident dietary management, activity scheduling, staff management, communications, and compliance.

---

## Features

| Module | Description | Min. Role |
|--------|-------------|----------|
| Dashboard | Facility overview, alerts, quick stats | All staff |
| Residents & Diet Orders | Resident profiles, dietary restrictions, care notes | All staff |
| Weekly Menu Planner | Meal planning and menu management | Dietary+ |
| Weekly Menu View | Read-only menu view for service staff | All staff |
| Recipe Book | Standardized recipes and nutritional info | All staff |
| Production & Service | Meal production tracking and tray service | All staff |
| Inventory & Waste | Stock management and waste logging | All staff |
| Communications | Internal staff messaging and announcements | All staff |
| Time Clock Logs | Staff timecard and punch log | All staff |
| Budget & Spending | Department budget tracking | Manager+ |
| Staff | Staff profiles and HR records | Manager+ |
| Administration | User accounts, roles, system settings | Admin only |
| Legal & Compliance | Privacy policy, terms, AUP, HIPAA NPP, BAA | All staff |

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Hosting:** Render
- **PWA:** Service worker, offline mode, installable
- **Node.js:** 24.x

---

## Staff Roles

| Role | Label | Access Level |
|------|-------|--------------|
| `admin` | Administrator | Full access |
| `manager` | Manager | All staff + budget, staff, admin view |
| `frontdesk` | Office Assistant | All staff routes |
| `dietary` | Dietary Staff | All staff + menu planner |
| `activities` | Activities Dir. | All staff routes |
| `server` | Server | All staff routes |
| `staff` | Staff | All staff routes |
| `readonly` | Read-Only | View-only access |

---

## Legal & Compliance

All legal documents are maintained in the repository root:

| File | Document |
|------|----------|
| [`PRIVACY.md`](./PRIVACY.md) | Privacy Policy (all-states compliant) |
| [`TERMS.md`](./TERMS.md) | Terms of Use |
| [`AUP.md`](./AUP.md) | Acceptable Use Policy |
| [`HIPAA_NOTICE.md`](./HIPAA_NOTICE.md) | HIPAA Notice of Privacy Practices |
| [`BAA.md`](./BAA.md) | Business Associate Agreement Template |

For privacy inquiries or to report a concern, contact the Privacy Officer at the address listed in each document.

---

## Security

See [`SECURITY.md`](./SECURITY.md) for vulnerability reporting procedures.

---

## License

Proprietary — Shoreline Operations LLC. All rights reserved. Unauthorized use, reproduction, or distribution is strictly prohibited.
