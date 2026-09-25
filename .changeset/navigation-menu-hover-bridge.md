---
"@data-slot/navigation-menu": patch
---

Fix the navigation menu hover bridge overlapping triggers during popup scale animations. Calculate the bridge from the menu's layout position and size so active triggers remain clickable while preserving hover travel across the gap.
