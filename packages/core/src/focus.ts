/**
 * Focusable descendants are elements that may receive programmatic focus.
 * Tabbables are the subset that participate in sequential keyboard navigation.
 */
const NATIVE_FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'iframe',
  'audio[controls]',
  'video[controls]',
].join(', ')
const FOCUSABLE_SELECTOR = `${NATIVE_FOCUSABLE_SELECTOR}, summary, [contenteditable], [tabindex]`

function isInert(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('inert') || (current as HTMLElement & { inert?: boolean }).inert) {
      return true
    }
  }
  return false
}

function isVisible(element: HTMLElement): boolean {
  const visibility = element.ownerDocument.defaultView?.getComputedStyle(element).visibility
  if (visibility === 'hidden' || visibility === 'collapse') return false

  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden) return false
    const ownerWindow: Window | null = current.ownerDocument.defaultView
    const style = ownerWindow?.getComputedStyle(current)
    if (style?.display === 'none') {
      return false
    }
  }
  return true
}

function isHiddenByClosedDetails(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element.parentElement; current; current = current.parentElement) {
    if (current.tagName !== 'DETAILS' || current.hasAttribute('open')) continue
    const firstSummary = Array.from(current.children).find((child) => child.tagName === 'SUMMARY')
    if (!firstSummary?.contains(element)) return true
  }
  return false
}

function isDisabledByFieldset(element: HTMLElement): boolean {
  if (!element.matches('button, input, select, textarea, option, optgroup')) return false
  const fieldset = element.closest('fieldset[disabled]')
  if (!fieldset) return false
  const firstLegend = Array.from(fieldset.children).find((child) => child.tagName === 'LEGEND')
  return !(firstLegend?.contains(element))
}

function isFocusable(element: HTMLElement): boolean {
  if (!hasFocusSemantics(element)) return false
  if (element.matches(':disabled') || isDisabledByFieldset(element)) return false
  return isVisible(element) && !isInert(element) && !isHiddenByClosedDetails(element)
}

function isEditable(element: HTMLElement | null): boolean {
  for (let current = element; current; current = current.parentElement) {
    const value = current.getAttribute('contenteditable')?.toLowerCase()
    if (value === 'false') return false
    if (value === '' || value === 'true' || value === 'plaintext-only') return true
  }
  return false
}

function hasFocusSemantics(element: HTMLElement): boolean {
  // Hidden inputs cannot receive focus even with an explicit tabindex.
  if (element.matches('input[type="hidden"]')) return false
  const tabindex = element.getAttribute('tabindex')
  if (tabindex !== null && !Number.isNaN(Number.parseInt(tabindex, 10))) return true
  if (element.matches(NATIVE_FOCUSABLE_SELECTOR)) return true
  if (element.tagName === 'SUMMARY' && element.parentElement?.tagName === 'DETAILS') {
    const firstSummary = Array.from(element.parentElement.children).find((child) => child.tagName === 'SUMMARY')
    if (firstSummary === element) return true
  }
  // Only an editing host has intrinsic focusability; nested editable elements
  // need their own tabindex unless a non-editable ancestor starts a new host.
  return isEditable(element) && !isEditable(element.parentElement)
}

function getFocusTree(element: HTMLElement): ParentNode {
  const root = element.getRootNode()
  if (root !== element) return root as ParentNode

  // Some lightweight DOM implementations return the element itself here for
  // shadow-tree descendants. Preserve native semantics by walking to its root.
  let current: Node = element
  while (current.parentNode) current = current.parentNode
  return current as ParentNode
}

function getCheckedRadioGroups(tree: ParentNode): Map<HTMLFormElement | null, Map<string, HTMLInputElement>> {
  const groups = new Map<HTMLFormElement | null, Map<string, HTMLInputElement>>()
  for (const radio of tree.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')) {
    if (!radio.name || getFocusTree(radio) !== tree || !isFocusable(radio)) continue
    let names = groups.get(radio.form)
    if (!names) {
      names = new Map()
      groups.set(radio.form, names)
    }
    if (!names.has(radio.name)) names.set(radio.name, radio)
  }
  return groups
}

export function getFocusable(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable)
}

/** Returns the valid autofocus target when present, otherwise the first focusable descendant. */
export function getAutofocusOrFirstFocusable(container: ParentNode): HTMLElement | undefined {
  const focusables = getFocusable(container)
  return focusables.find((element) => element.hasAttribute('autofocus')) ?? focusables[0]
}

export function getTabbables(container: ParentNode): HTMLElement[] {
  // Keep discovery local to this call so checked state, form ownership and
  // visibility changes are reflected on the next keyboard interaction.
  const radioGroups = new Map<ParentNode, ReturnType<typeof getCheckedRadioGroups>>()
  return getFocusable(container).filter((element) => {
    const tabindex = element.getAttribute('tabindex')
    if (tabindex !== null && Number.parseInt(tabindex, 10) < 0) return false
    const Input = element.ownerDocument.defaultView?.HTMLInputElement
    if (!Input || !(element instanceof Input) || element.type !== 'radio' || !element.name) return true
    const tree = getFocusTree(element)
    let groups = radioGroups.get(tree)
    if (!groups) {
      groups = getCheckedRadioGroups(tree)
      radioGroups.set(tree, groups)
    }
    const checked = groups.get(element.form)?.get(element.name)
    return !checked || checked === element
  })
}
