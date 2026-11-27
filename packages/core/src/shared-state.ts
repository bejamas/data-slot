// State that every copy of core on a page must see, e.g. when components pin
// different core versions or a bundler inlines core into separate chunks. It is
// keyed on registry-wide symbols, like the root binding and portal owner symbols.
//
// Each stored shape is a contract between core versions: keep it minimal, and
// bump the key's version suffix on an incompatible change so copies with
// different shapes keep separate state instead of corrupting each other's.
type SharedRegistry = Record<symbol, unknown>;

const localRegistry: SharedRegistry = {};

export function getSharedState<T>(key: symbol, create: () => T): T {
  const registry = typeof globalThis === "object" ? (globalThis as unknown as SharedRegistry) : localRegistry;
  return (registry[key] ??= create()) as T;
}
