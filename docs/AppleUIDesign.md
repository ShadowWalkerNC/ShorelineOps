# Apple UI Design System Integration

ShorelineOps integrates Apple's official Human Interface Guidelines (HIG) design system and tokens to deliver an intuitive, clean, and tactile interface for senior living staff.

## Components in `src/apple-ui/`
- `AppleButton`: Tactile button with Apple active spring feel (`active:scale-[0.98]`), supporting `primary`, `secondary`, `tinted`, `glass`, `destructive`, and `success` variants.
- `AppleCard`: Vibrant glassmorphism card with dynamic blur backdrop and high-contrast borders.
- `AppleBadge`: Apple HIG status pill with optional live dot indicator.
- `AppleSegmentedControl`: Smooth Cupertino-style sliding segmented selector.

## Usage Example
```tsx
import { AppleButton, AppleCard, AppleBadge } from "@/apple-ui";

export function MealReview() {
  return (
    <AppleCard variant="glass" header="Meal Order Verification">
      <AppleBadge color="green" dot>Verified Safe</AppleBadge>
      <AppleButton variant="primary" className="mt-4">
        Approve Tray
      </AppleButton>
    </AppleCard>
  );
}
```
