# Shoreline v5

> React 18 + Vite + TypeScript + Tailwind CSS  
> Rebuild of the [Shoreline v4](https://github.com/ShadowWalkerNC/Shoreline) care operations platform.

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| Build tool | Vite |
| CSS | Tailwind CSS |
| State | Zustand |
| Routing | React Router v6 |
| Backend | Existing Node/Express from v4 (Phase 1) |

## Getting Started

```bash
npm install
npm run dev        # starts on http://localhost:3000
```

The dev server proxies `/api/*` to `http://localhost:4000` (v4 Express backend).

## Module Port Order

- [x] **Scaffold** — Vite + React + TypeScript + Tailwind + Zustand + React Router
- [ ] **Residents** — port `app-residents.js` (22KB) — *in progress*
- [ ] **Menu Planner** — port `app-menu.js` (50KB)
- [ ] **Production** — port `app-production.js` (75KB)
- [ ] **Administration** — port `app-admin.js` (208KB)
- [ ] **Budget** — port `budget.js` (27KB)
- [ ] **Maintenance** — port `maintenance.js` (23KB)
- [ ] **Dashboard** — real-time SSE, typed metrics

See [ARCHITECTURE.md in Shoreline](https://github.com/ShadowWalkerNC/Shoreline/blob/main/ARCHITECTURE.md) for the full stack decision and migration strategy.
