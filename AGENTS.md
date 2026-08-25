# AGENTS.md — ShorelineOps (Care OS v5.0)

> **Extends:** `ShadowWalkerNC/.github/AGENTS.md` — all global rules apply unconditionally.
> **Purpose:** Project-specific overrides and context for AI agents working in this repository.
> **Auto-loaded by:** Claude Code · GitHub Copilot · OpenAI Codex · Cursor · Windsurf · Antigravity

---

## Project Identity

```
Project:      ShorelineOps
Description:  Shoreline Care OS v5.0 — Open-Source Healthcare Dietary & Clinical Nutrition Operations Platform
Status:       production-ready
Phase:        5 — Open Core & Commercial SaaS Scale
Priority:     active
```

---

## Tech Stack

```
Language:     TypeScript / Node.js (v20+)
Frontend:     React 18 + Vite + Tailwind CSS + shadcn/ui + Radix UI + Zustand
Marketing:    Astro + Tailwind CSS (Apple HIG Design Language)
Backend API:  Node.js + Express + Helmet + Argon2 + LRU Cache + Dedup + Circuit Breakers
Database:     SQLite (local offline-first) / PostgreSQL / Supabase
Key Integrations: PointClickCare (OAuth/FHIR), Dennis Food Service EDI, Sysco IMPAC, USDA FoodData Central
Testing:      Node.js test harness (89/89 automated system tests passing)
```

---

## Repository Structure

```
ShorelineOps/
  src/
    components/ui/   ← shadcn/ui accessible components (Button, Card, Badge, Dialog, etc.)
    features/        ← Core business modules:
      residents/     ← Census, therapeutic diet orders, IDDSI textures, EHR triage queue
      menu/          ← 4-week seasonal cycle menu planner & recipe drawer
      production/    ← Batch cook sheets, station scaling, HACCP 165°F temperature logs
      recipes/       ← Master recipe book, yield scaler, USDA nutrition solver
      kitchen/       ← Touch tablet kiosk, QR assembly scanner, par stepper count
      purchasing/    ← Lowest-cost Dennis/Sysco split MRP, 3-way invoice match, credit memos
      reporting/     ← Cost per resident day ($/CPD), CMS-2567 federal survey binder
      distributor/   ← Vendor partner catalog master, EDI connectors, plugin marketplace
      settings/      ← Facility profile, wings, dining rooms, meal schedule, licensing
      admin/         ← Staff scheduling, user accounts, audit log, HealerBot
    security/        ← JWT auth context, Argon2 hashing, Open Core license entitlement engine
    state/           ← Zustand reactive state stores with localStorage/IndexedDB persistence
  server/            ← Express API server, routes, middleware, and test suites
  marketing/         ← Astro public website, pricing calculator, distributor guide, founder story
  docs/              ← Architecture specs, clinical safety guides, daily operations audit log
  scripts/           ← Operations consultant audit runner, backup routines
```

---

## Key Files for Every Agent Session

```
ARCHITECTURE.md                ← System design, data flows, module responsibilities
TODO.md                        ← Current open work & verified milestones
CHANGELOG.md                   ← Release history (v1.0.0 through v9.0.0)
LICENSING.md                   ← Open Core vs Commercial SaaS tier matrix
docs/DAILY_OPERATIONS_AUDIT.md ← Daily clinical & culinary audit log
```

---

## Active Agents for This Project

```
Always active:  COHERENCE · SECURITY · DOCS
Project default: dietary_operations_consultant · ENGINEER · DATABASE · UX · QA
Autonomous Review: dietary_operations_consultant (audits clinical safety, IDDSI 2.0, kitchen ergonomics)
```

---

## Project-Specific Rules

- **Deterministic Clinical Safety**: Never bypass NPO hard-blocks or allergen exclusion alerts. Safety checks are non-overridable.
- **Open Core Architecture**: Core single-facility operational tools remain open-source and offline-capable. Proprietary SaaS endpoints (PCC Live Sync, Multi-Distributor Split MRP, CMS-2567 Binder, 3-Way Match) must be gated with `requireTier('enterprise')` and `<FeatureGate>`.
- **shadcn/ui & Apple HIG Consistency**: UI components must use standard shadcn/ui wrappers (`src/components/ui/`) with Apple HIG frosted glass headers and responsive touch targets ($\ge 44\text{px}$).
- **Testing Before Push**: `npm run build:demo && npm run build:marketing && npm test` must pass 100% before committing code.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | API Server port (default: 3001) |
| `JWT_SECRET` | Required (Prod) | Secret key for signing bearer tokens |
| `SHORELINE_LICENSE_KEY` | Optional | Cryptographic license key for Pro/Enterprise SaaS (`SH_PRO_...` / `SH_ENT_...`) |
| `VITE_DEMO_MODE` | Optional | Enable pre-seeded demo sandbox mode (`true` on Render/Vercel) |

---

## Agent Confirmation for This Repo

```
Project AGENTS.md: loaded
Project: ShorelineOps (Care OS v5.0)
Stack: TypeScript + React 18 + Vite + Tailwind + shadcn/ui + Node.js + Express
Phase: 5 — Open Core & Commercial SaaS Scale
Project rules active: 4 overrides
Known issues noted: none
```
