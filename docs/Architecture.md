# System Architecture

ShorelineOps is architected as a modular, high-reliability platform that bridges clinical healthcare records with back-of-house commercial kitchen operations.

```
+-------------------------------------------------------------------------+
|                           PRESENTATION LAYER                            |
|  React 18 PWA • Apple HIG UI Kit • Vite • Tailwind • Zustand • WebAudio  |
+------------------------------------+------------------------------------+
                                     | REST / JSON (JWT + RBAC)
+------------------------------------v------------------------------------+
|                             API & ROUTING                               |
|  Express.js • Helmet Security • Rate Limiting • In-Memory Cache (LRU)  |
+------------------+-------------------+-------------------+--------------+
                   |                   |                   |
+------------------v----+ +------------v------+ +----------v--------------+
|    CLINICAL SAFETY    | | PRODUCTION & MRP  | |  FINANCIAL & COMPLIANCE |
| • SafetyEvaluator     | | • ProductionEngine| | • InvoicingEngine       |
| • QR-Token Verifier   | | • MrpForecast     | | • CmsSurveyEngine       |
| • IDDSI Matrix        | | • Unit Conversion | | • Audit Immutability    |
+------------------+----+ +------------+------+ +----------+--------------+
                   |                   |                   |
+------------------v-------------------v-------------------v--------------+
|                             DATA STORE                                  |
|  PostgreSQL 15 (Foreign Keys, Cascade Deletes, Append-Only Triggers)   |
+-------------------------------------------------------------------------+
```

## Core Design Principles
1. **Clinical Non-Negotiability**: Resident safety hard-blocks execute deterministically before any meal ticket or production batch can be dispatched.
2. **Zero-Trust Kitchen Offline Resilience**: Line cooks on mobile tablets can verify tray tokens and consult batch scale worksheets even during network drops.
3. **Distributor-Agnostic Cost Optimization**: Raw ingredient demand explodes across vendor catalogs to guarantee the lowest cost per resident day.
