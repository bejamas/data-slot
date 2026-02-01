# CLAUDE.md - Development Guide for @data-slot

This document captures conventions, patterns, and guidelines for developing new packages in the @data-slot monorepo.

## Project Overview

**Monorepo structure:**
- `packages/` - Component packages and core utilities
- `website/` - Astro-based documentation site

**Package naming:** `@data-slot/{component-name}`

**Current version:** 0.2.10 (synchronized across all packages)

## Package Structure Template

```
packages/{component-name}/
├── src/
│   ├── index.ts          # Main implementation
│   └── index.test.ts     # Bun tests
├── package.json
├── tsdown.config.ts
└── README.md
```

## Core Utilities (@data-slot/core)

All components import from `@data-slot/core`. Available utilities:

### DOM Utilities
```typescript
import { getPart, getParts, getRoots, getDataBool, getDataNumber, getDataString, getDataEnum } from "@data-slot/core";

// Find single part within root
getPart<HTMLElement>(root, "tabs-list")

// Find all parts within root
getParts<HTMLElement>(root, "tabs-trigger")

// Find all root elements in scope
getRoots(scope, "tabs")

// Read typed data attributes (converts kebab-case to camelCase)
getDataString(root, "defaultValue")  // reads data-default-value
getDataNumber(root, "min")           // reads data-min, returns number
getDataBool(root, "disabled")        // reads data-disabled, returns boolean
getDataEnum(root, "orientation", ["horizontal", "vertical"] as const)
```

### ARIA Utilities
```typescript
import { ensureId, setAria, linkLabelledBy } from "@data-slot/core";

// Generate unique ID if element doesn't have one
ensureId(element, "tab")  // Returns existing id or generates "tab-{random}"

// Set ARIA attributes (handles boolean conversion)
setAria(element, "selected", true)   // aria-selected="true"
setAria(element, "expanded", false)  // aria-expanded="false"
setAria(element, "orientation", "vertical")

// Link label to element
linkLabelledBy(element, labelElement)
```

### Event Utilities
```typescript
import { on, emit, composeHandlers } from "@data-slot/core";

// Add event listener, returns cleanup function
const cleanup = on(element, "click", handler)

// Emit custom event
emit(root, "tabs:change", { value: "two" })

// Compose multiple handlers
composeHandlers(handler1, handler2)
```

## Component Implementation Pattern

### Interfaces
```typescript
export interface ComponentOptions {
  /** Initial value */
  defaultValue?: string;
  /** Callback when value changes */
  onValueChange?: (value: string) => void;
  /** Orientation for keyboard navigation */
  orientation?: "horizontal" | "vertical";
}

export interface ComponentController {
  /** Change value programmatically */
  select(value: string): void;
  /** Currently selected value */
  readonly value: string;
  /** Cleanup all event listeners */
  destroy(): void;
}
```

### Factory Function
```typescript
export function createComponent(
  root: Element,
  options: ComponentOptions = {}
): ComponentController {
  // 1. Query parts
  const list = getPart<HTMLElement>(root, "component-list");
  const items = getParts<HTMLElement>(root, "component-item");

  if (!list || items.length === 0) {
    throw new Error("Component requires component-list and at least one component-item");
  }

  // 2. Resolve options: JS > data-* > defaults
  const orientation = options.orientation ?? getDataEnum(root, "orientation", ORIENTATIONS) ?? "horizontal";
  const defaultValue = options.defaultValue ?? getDataString(root, "defaultValue") ?? "";
  const onValueChange = options.onValueChange;

  // 3. State (closure-based, no classes)
  let currentValue = defaultValue;
  const cleanups: Array<() => void> = [];

  // 4. Setup ARIA roles
  list.setAttribute("role", "listbox");
  for (const item of items) {
    item.setAttribute("role", "option");
    ensureId(item, "item");
  }

  // 5. State application function
  const applyState = (value: string, init = false) => {
    if (currentValue === value && !init) return;
    currentValue = value;

    // Update visual state
    for (const item of items) {
      const isSelected = item.dataset.value === value;
      setAria(item, "selected", isSelected);
      item.dataset.state = isSelected ? "active" : "inactive";
    }

    // Emit events (skip on init)
    if (!init) {
      emit(root, "component:change", { value });
      onValueChange?.(value);
    }
  };

  applyState(currentValue, true);

  // 6. Event handlers (add to cleanups array)
  cleanups.push(on(list, "click", (e) => { /* ... */ }));
  cleanups.push(on(list, "keydown", (e) => { /* ... */ }));

  // 7. Inbound event listener
  cleanups.push(on(root, "component:select", (e) => {
    const detail = (e as CustomEvent).detail;
    const value = typeof detail === "string" ? detail : detail?.value;
    if (value) applyState(value);
  }));

  // 8. Return controller
  return {
    select: (value: string) => applyState(value),
    get value() { return currentValue; },
    destroy: () => {
      cleanups.forEach(fn => fn());
      cleanups.length = 0;
      bound.delete(root);
    },
  };
}
```

### Auto-Discovery Function
```typescript
// WeakSet prevents double-binding
const bound = new WeakSet<Element>();

/**
 * Find and bind all component instances in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): ComponentController[] {
  const controllers: ComponentController[] = [];

  for (const root of getRoots(scope, "component")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createComponent(root));
  }

  return controllers;
}
```

## Data-Slot Attribute System

### Root Element
```html
<div data-slot="tabs">
```

### Parts
```html
<div data-slot="tabs-list">
<button data-slot="tabs-trigger" data-value="one">
<div data-slot="tabs-content" data-value="one">
<div data-slot="tabs-indicator">
```

### Configuration Attributes
```html
data-default-value="two"
data-orientation="vertical"
data-activation-mode="manual"
data-multiple
data-disabled
data-min="0"
data-max="100"
data-step="1"
```

### State Attributes (set by component)
```html
data-state="active"    <!-- or "inactive", "open", "closed" -->
data-value="current"   <!-- current value on root -->
data-disabled          <!-- disabled state -->
data-dragging          <!-- during drag interactions -->
```

## ARIA & Accessibility Requirements

### Required ARIA Setup
1. **Semantic roles** - Set appropriate `role` attribute
2. **Roving focus** - Manage `tabIndex` (0 for active, -1 for others)
3. **ARIA states** - `aria-selected`, `aria-expanded`, `aria-disabled`
4. **Linking** - `aria-controls`, `aria-labelledby`
5. **ID generation** - Use `ensureId()` for stable references

### Example ARIA Setup
```typescript
// List/container
list.setAttribute("role", "tablist");
if (orientation === "vertical") {
  setAria(list, "orientation", "vertical");
}

// Items
for (const item of items) {
  item.setAttribute("role", "tab");
  const id = ensureId(item, "tab");

  if (panel) {
    panel.setAttribute("role", "tabpanel");
    const panelId = ensureId(panel, "tabpanel");
    item.setAttribute("aria-controls", panelId);
    panel.setAttribute("aria-labelledby", id);
  }
}
```

## Event System

### Outbound Events (component emits)
```typescript
emit(root, "tabs:change", { value: "two" });
emit(root, "slider:change", { value: 50 });
emit(root, "slider:commit", { value: 50 });  // On interaction end
```

### Inbound Events (component listens)
```typescript
// Support both object and string detail
cleanups.push(on(root, "tabs:select", (e) => {
  const evt = e as CustomEvent;
  const detail = evt.detail;
  const value = typeof detail === "string" ? detail : detail?.value;
  if (value) applyState(value);
}));
```

### Callback Pattern
```typescript
onValueChange?.(value);     // During interaction
onValueCommit?.(value);     // When interaction ends (blur, pointer up)
```

## Keyboard Navigation

### Orientation-Aware Navigation
```typescript
const isHorizontal = orientation === "horizontal";
const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
```

### Standard Key Handlers
```typescript
switch (e.key) {
  case prevKey:
    nextIdx = idx - 1;
    if (nextIdx < 0) nextIdx = enabled.length - 1;  // Wrap
    break;
  case nextKey:
    nextIdx = idx + 1;
    if (nextIdx >= enabled.length) nextIdx = 0;    // Wrap
    break;
  case "Home":
    nextIdx = 0;
    break;
  case "End":
    nextIdx = enabled.length - 1;
    break;
  case "Enter":
  case " ":
    e.preventDefault();
    activate(item);
    return;
  default:
    return;
}

e.preventDefault();
enabled[nextIdx].el.focus();
```

### Activation Modes
- **auto** (default): Arrow keys select immediately
- **manual**: Arrow keys move focus only, Enter/Space activates

## Testing Conventions

### Test File Structure
```typescript
import { describe, expect, it } from 'bun:test';
import { createComponent, create } from './index';

describe('Component', () => {
  const setup = (defaultValue?: string) => {
    document.body.innerHTML = `
      <div data-slot="component" id="root">
        <!-- markup -->
      </div>
    `;
    const root = document.getElementById('root')!;
    const controller = createComponent(root, { defaultValue });

    return { root, controller, /* other elements */ };
  };

  // Tests organized by category
  it('initializes with default state', () => { /* ... */ });
  it('sets correct ARIA roles', () => { /* ... */ });
  it('navigates with arrow keys', () => { /* ... */ });
  it('emits change event', () => { /* ... */ });
  it('destroy cleans up listeners', () => { /* ... */ });

  describe('data attributes', () => {
    it('reads data-orientation', () => { /* ... */ });
  });
});
```

### Test Categories
1. **Initialization** - Default state, specified values, data attributes
2. **ARIA** - Roles, states, linking
3. **Interaction** - Click, keyboard navigation
4. **Events** - Outbound events, callbacks
5. **Lifecycle** - destroy() cleanup

### Running Tests
```bash
bun test                           # Run all tests
bun test packages/tabs             # Run specific package
bun test --watch                   # Watch mode
```

## Website Integration Checklist

When adding a new component package:

### 1. Create Example Component
Create `website/src/components/examples/{ComponentName}.astro`:
```astro
---
// No imports needed for HTML-only component
---
<div data-slot="component" class="component-demo">
  <!-- Example markup -->
</div>
```

### 2. Update Package Sizes
Edit `website/src/data/package-sizes.json`:
```json
{
  "component": { "esm": 1234, "cjs": 1567 }
}
```

### 3. Update Homepage
Edit `website/src/pages/index.astro`:
```astro
---
import ComponentExample from '../components/examples/ComponentName.astro';
---

<!-- Add to components section -->
<ComponentExample />

<!-- Add to script imports -->
<script>
  import { create as createComponent } from '@data-slot/component';
  createComponent();
</script>
```

### 4. Add Styles (if needed)
Edit `website/src/styles/demo.css`:
```css
[data-slot="component"] {
  /* styles */
}
```

## Build & Release

### Build Commands
```bash
bun run --filter './packages/*' build   # Build all packages
bun run build                           # Build from package directory
```

### Test Commands
```bash
bun test                    # Run all tests
bun test packages/tabs      # Run specific package tests
```

### Version Management
```bash
bun run version             # Updates version across all packages
```

All packages share the same version number, managed from the root.

## data-slot Package Updates

The `data-slot` package re-exports all components for convenience imports. When adding a new component:

### 1. Create Re-export File
Create `packages/data-slot/src/{component}.ts`:
```typescript
export * from "@data-slot/component";
```

### 2. Update Build Config
Edit `packages/data-slot/tsdown.config.ts`:
```typescript
export default defineConfig({
  entry: [
    "src/index.ts",
    // ... existing entries
    "src/component.ts",  // Add new entry
  ],
  // ...
});
```

### 3. Update Package Exports
Edit `packages/data-slot/package.json`:
```json
{
  "exports": {
    "./component": {
      "import": {
        "types": "./dist/component.d.ts",
        "default": "./dist/component.js"
      },
      "require": {
        "types": "./dist/component.d.cts",
        "default": "./dist/component.cjs"
      }
    }
  },
  "devDependencies": {
    "@data-slot/component": "workspace:*"
  }
}
```

## Key Implementation Notes

1. **Option precedence:** JS options > data-* attributes > defaults
2. **Closure-based state:** No classes, use closures for encapsulation
3. **WeakSet for binding:** Prevents double-initialization on same element
4. **Cleanup array:** Collect all cleanup functions, call in destroy()
5. **Button type:** Set `type="button"` on button elements to prevent form submission
6. **Disabled handling:** Check `disabled` attr, `data-disabled`, and `aria-disabled`
