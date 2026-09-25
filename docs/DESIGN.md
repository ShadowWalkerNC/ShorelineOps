# ShorelineOps Care OS — Design System & Brand Guide (DESIGN.md)

> **Identity**: ShorelineOps Care OS v5.0  
> **Philosophy**: Apple Human Interface Guidelines (HIG) + Jakob's Law Mobile Ergonomics + Clinical Safety Rigor  
> **Target Audience**: Executive Chefs, Clinical Registered Dietitians, Healthcare Kitchen Cooks, Facility Administrators

---

## 1. Design Principles

1. **Card-First Isolation**:
   Every record, order, form, and section is an isolated, self-contained `<Card>` container. Distinct borders (`border-slate-200/80 dark:border-slate-800/80`), subtle backdrop blur (`backdrop-blur-xl`), and rounded corners (`rounded-2xl` / `rounded-3xl`) ensure immediate visual separation.

2. **Jakob's Law & Thumb-Zone Ergonomics**:
   Users spend most of their time on other native apps. We follow familiar conventions:
   - Sticky bottom navigation bar on mobile with core destinations: `Dashboard`, `Census`, `Kitchen`, `Tasks`, `More`.
   - Primary mobile actions live in the bottom 40% of the screen (the comfortable thumb zone).
   - Filter criteria and secondary menus slide up as native bottom sheets, not tiny dropdown menus.

3. **Touch-First for Gloved Hands**:
   In healthcare kitchens, cooks operate with wet or gloved hands under intense steam:
   - Interactive touch targets must be $\ge 44\text{px}$ (iOS HIG) / $\ge 48\text{px}$ (Material Design).
   - Buttons provide immediate tactile feedback on press (`active:scale-[0.98]`).
   - High contrast ratios (WCAG 2.1 AA minimum 4.5:1 for body, 3:1 for large text).

4. **Task-Specific Clutter Reduction**:
   Views show only what is relevant to the active role and task. When a cook is logging temperatures or an aide is taking an order, administrative settings, contract pricing, and complex filters are suppressed.

5. **Deterministic Clinical Safety & Non-Vague Confirmations**:
   - Choking and allergy risks are highlighted with non-overridable visual alerts.
   - Deleting any clinical, resident, recipe, or inventory record triggers an explicit `<ConfirmDestructiveDialog />` stating exactly what is being deleted, what wings/residents are impacted, and requiring conscious confirmation.

---

## 2. Color Palette & Semantic Tokens

### Primary Brand
- **Shoreline Blue** (`#0284c7` / `text-sky-600` / `bg-sky-600`): Primary actions, clinical links, and system indicators.
- **Teal Accent** (`#0d9488` / `text-teal-600`): Clinical EMR modules, resident safety profiles, and validated badges.
- **Apple Blue** (`#0071e3`): Primary CTA highlights and clean interactive pills.

### Functional Status & Severity
- **Success / Green** (`#10b981` / `text-emerald-600` / `bg-emerald-500`): Completed tray runs, safe HACCP temperatures, in-stock inventory.
- **Warning / Amber** (`#f59e0b` / `text-amber-600` / `bg-amber-500`): Low par levels, pending approvals, modified IDDSI warnings.
- **Danger / Red** (`#ef4444` / `text-rose-600` / `bg-rose-500`): Non-overridable NPO hard-blocks, anaphylactic allergen alerts, out-of-temp HACCP hazards, destructive actions.

### Neutrals & Surfaces
- **App Background**: `#f5f5f7` (Light Apple Grey) / `#0d1b2a` (Dark Slate Navy)
- **Card Background**: `rgba(255, 255, 255, 0.85)` (Light) / `rgba(15, 23, 42, 0.85)` (Dark)
- **Borders**: `border-slate-200/80` (Light) / `border-slate-800/80` (Dark)
- **Subtle Shadows**: `shadow-apple-card` (`0 4px 24px -2px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.04)`)

---

## 3. Typography Scale

Fonts: **Outfit** (Display headings, numbers, stat cards) & **Inter** (Body copy, table cells, form controls).

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-xs` | 11px | 500 / 600 | Eyebrow badges, metadata, IDDSI chips |
| `--text-sm` | 12px | 400 / 500 | Secondary text, table descriptions |
| `--text-base` | 14px | 400 / 600 | Standard body copy, inputs, table cells |
| `--text-md` | 15px | 500 / 600 | Button labels, callout text |
| `--text-lg` | 16px | 600 / 700 | Card titles, section headers |
| `--text-xl` | 18px | 700 | Subpage headings (H3) |
| `--text-2xl` | 20px | 700 | Page sub-headings (H2) |
| `--text-3xl` | 22px (mobile) / 26px (desktop) | 800 | Primary page titles (H1) |

---

## 4. Animation & Interaction Timing

All transitions must respect `prefers-reduced-motion`:
- **Page & View Transition**: 180ms ease-out opacity fade + 4px vertical rise (`opacity: 0 -> 1`, `translateY: 4px -> 0px`).
- **Tactile Button Feedback**: 80ms quick scale (`active:scale-[0.98]`).
- **Modal & Bottom Sheet**: 200ms spring/ease-out backdrop blur and entry slide.

---

## 5. Standard Component Guidelines

### Card (`<Card>`)
- Default container for all dashboard panels, resident lists, menu sheets, and forms.
- Padding: `p-4 sm:p-6`.
- Radius: `rounded-2xl` on mobile, `rounded-3xl` on desktop.

### Button (`<Button>`)
- Height: Standard is `h-11 px-5` ($\ge 44\text{px}$) for comfortable touch ergonomics.
- Variants: `default`, `apple`, `destructive`, `outline`, `secondary`, `ghost`.

### Destructive Action Confirmation (`<ConfirmDestructiveDialog>`)
- Never rely on browser `window.confirm()`.
- Must display:
  1. Destructive banner with red warning icon.
  2. The exact item name in bold.
  3. A bulleted consequence summary (e.g., *"This resident's active tray tickets and diet order history will be deleted"*).
  4. Explicit action buttons: `Cancel` (secondary, safe) and `Delete [Item Type]` (red destructive).
