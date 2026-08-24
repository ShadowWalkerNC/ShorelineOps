# Multi-Distributor Split MRP Engine

The `MrpDemandForecastEngine` computes Material Requirements Planning across multiple broadline vendors (Dennis Food Service, Sysco, US Foods, Gordon).

## Comparator Algorithm
For each raw ingredient demand:
1. Calculates effective cost per gram across all vendor quotes:
   `Cost Per Gram = Case Pack Price / Case Pack Net Weight (Grams)`
2. Checks vendor lead-time vs. meal service date.
3. Automatically rounds up to whole vendor case packs.
4. Generates split Purchase Orders grouped by vendor.
