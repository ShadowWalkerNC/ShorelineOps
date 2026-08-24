# Deterministic Clinical Safety Engine

The `SafetyEvaluatorEngine` enforces medical dietary orders across four rigorous layers:

## 1. Hard-Block Rules
- `NPO_VIOLATION`: If resident order is marked NPO (Nil Per Os), all meals are blocked.
- `ALLERGEN_INTERSECTION`: Immediate block if any ingredient or cross-contact allergen matches the resident record.
- `IDDSI_FOOD_MISMATCH`: Hard block if food texture (e.g. Regular Level 7) exceeds resident swallowing capacity (e.g. Pureed Level 4).
- `IDDSI_LIQUID_MISMATCH`: Hard block if drink thickness does not match prescribed liquid level (Thin Level 0 vs. Nectar Level 2).

## 2. Clinical Nutrient Ceilings
| Diet Type | Nutrient Constraint | Maximum Allowed / Meal |
|---|---|---|
| No Added Salt (NAS) | Sodium (mg) | <= 600 mg |
| Low Sodium | Sodium (mg) | <= 800 mg |
| Diabetic / NCS | Total Carbs (g) | <= 60 g |
| Renal Diet | Potassium (mg) | <= 700 mg |
| Renal Diet | Phosphorus (mg) | <= 300 mg |

## Code Example
```typescript
import { SafetyEvaluatorEngine } from "../engine/safetyEvaluator";

const evaluation = SafetyEvaluatorEngine.evaluateMealSafety(residentProfile, recipe);
if (!evaluation.isSafe) {
  console.error("Meal blocked:", evaluation.hardBlocks);
}
```
