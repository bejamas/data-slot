# Tooltip: Radix-aligned API + interaction improvements

## Summary

- **Rename `position` → `side`** and add `align` option for Radix/Base UI compatibility
- **Hoverable content**: pointer can move from trigger to content without closing
- **Focus priority**: tooltip stays open while trigger has focus, even if pointer leaves
- **Touch support**: focus-only on touch devices (no hover open)
- **Disabled triggers**: respects `disabled` and `aria-disabled` attributes
- **ARIA improvements**: `aria-describedby` only set when open, explicit `aria-hidden` values
- **Performance**: Escape listener only attached when open
- **CSS visibility**: uses `data-state` instead of `hidden` attribute

## Breaking Changes

- `position` option renamed to `side`
- `data-position` attribute renamed to `data-side`
- Content visibility now controlled via CSS `data-state` (not `hidden` attribute)

## Test Plan

- [x] All 38 tooltip tests pass (expanded from 14)
- [x] Side/align options work via JS and data attributes
- [x] Content-first fallback for placement attributes
- [x] Hoverable content behavior
- [x] Focus priority behavior
- [x] Touch device behavior (focus-only)
- [x] Disabled trigger handling
- [x] Escape listener cleanup
