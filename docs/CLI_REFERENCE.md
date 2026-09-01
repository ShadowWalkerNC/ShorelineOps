# ShorelineOps & CulinaryOS Unified CLI Reference

> **Binary:** `bin/shoreline.js`  
> **Aliases:** `shoreline`, `culinaryos`  
> **Version:** 5.0.0 (Care OS Production Core)  
> **Output Formats:** Interactive High-Contrast Terminal / Machine-Readable JSON (`--json`)

---

## Overview

The **ShorelineOps / CulinaryOS CLI** provides direct programmatic and headless control over every operational module in the platform. It can be called from command lines, CI/CD scripts, autonomous AI agents, Model Context Protocol (MCP) servers, or custom external microservices.

---

## Installation & Execution

```bash
# Direct local execution
npm run cli -- <command> [subcommand] [flags]

# Direct node invocation
node bin/shoreline.js <command> [subcommand] [flags]

# Global execution (if linked via npm link)
shoreline <command> [subcommand] [flags]
culinaryos <command> [subcommand] [flags]
```

---

## Global Options

| Flag | Description | Example |
|---|---|---|
| `--json` | Output structured JSON instead of human-readable tables | `shoreline census --json` |
| `--help`, `-h` | Display command help and usage syntax | `shoreline --help` |
| `--version`, `-v` | Display platform and CLI version | `shoreline --version` |

---

## Command Reference

### 1. Resident Census & Clinical Triage (`residents`, `census`)

Query active census, therapeutic diet orders, IDDSI textures, and inspect inbound EHR changes from PointClickCare.

```bash
# List all active residents
shoreline residents

# Filter by diet order
shoreline residents --diet=NAS

# Filter by IDDSI texture level
shoreline residents --texture=Pureed

# List only NPO (Nil Per Os) hard-blocked residents
shoreline residents --npo

# View inbound PointClickCare EHR triage queue
shoreline residents triage
```

---

### 2. Seasonal Cycle Menus & USDA Compliance (`menu`)

Inspect 4-week seasonal menus, audit USDA micronutrient compliance, verify protein rotation variety, and validate CMS F809 14-hour meal spans.

```bash
# View current meal cycle
shoreline menu --date=2026-09-01

# Audit CMS F809 dinner-to-breakfast span and USDA cardiac sodium thresholds
shoreline menu audit
```

---

### 3. Kitchen Production & IDDSI Demand Scaling (`production`)

Explode batch meal demand across hot line steam tables and prep stations with exact liquid binder ratios and AP vs EP yield loss formulations.

```bash
# Split 60 census portions across steam table, pureeing blender, and minced prep
shoreline production split --census=60 --recipe="Herb Roasted Turkey Breast"

# Calculate As-Purchased (AP) vendor requirements from Edible Portion (EP) demand factoring shrinkage
shoreline production ap-ep --ep-demand=15 --shrinkage=0.25 --unit-cost=4.20
```

---

### 4. Tray Line Assembly & HACCP Temperatures (`kitchen`)

Verify meal tickets, enforce non-overridable NPO clinical blocks, and log HACCP 165°F core cooking temperatures.

```bash
# Verify resident meal safety token
shoreline kitchen verify-tray --resident-id=SH-001

# Log HACCP temperature and verify FDA threshold
shoreline kitchen log-temp --item="Herb Roasted Turkey" --temp=168.4 --station="Steam Table 1"
```

---

### 5. Multi-Distributor Lowest-Cost Split MRP (`purchasing`, `mrp`)

Cross-compare live distributor pricing (Dennis Food Service vs Sysco), enforce drop minimums, and generate optimized split purchase orders.

```bash
# Compare Dennis vs Sysco for ingredient demand
shoreline purchasing split-po --item="Boneless Turkey Breast" --demand=45 --json
```

---

### 6. CMS-2567 State Survey Binder & CPD Spend (`survey`, `reporting`)

Generate unannounced state health inspection binders covering CMS F-Tags F800 through F814 and analyze $/CPD food budgets.

```bash
# Generate 1-click survey binder
shoreline survey cms-binder

# View daily and monthly Cost Per Resident Day ($/CPD) spend breakdown
shoreline reporting cpd
```

---

### 7. Model Context Protocol Tools (`mcp`)

Inspect and execute standardized MCP tool definitions for external LLMs and agent toolkits.

```bash
# List available MCP tools
shoreline mcp tools
```

---

### 8. System Health Diagnostic (`doctor`, `health`)

Execute automated self-healing diagnostic scan across SQLite database, HACCP logs, and clinical safety engines.

```bash
# Run complete system health scan
shoreline doctor
```
