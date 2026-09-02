/**
 * Focusable descendants are elements that may receive programmatic focus.
 * Tabbables are the subset that participate in sequential keyboard navigation.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ')

function isInert(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('inert') || (current as HTMLElement & { inert?: boolean }).inert) {
      return true
    }
  }
  return false
}

function isVisible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden) return false
    const ownerWindow: Window | null = current.ownerDocument.defaultView
    const style = ownerWindow?.getComputedStyle(current)
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') {
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
  if (element.matches(':disabled') || isDisabledByFieldset(element)) return false
  return isVisible(element) && !isInert(element) && !isHiddenByClosedDetails(element)
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

function isRadioTabbable(element: HTMLElement): boolean {
  const Input = element.ownerDocument.defaultView?.HTMLInputElement
  if (!Input || !(element instanceof Input) || element.type !== 'radio' || !element.name) return true
  const tree = getFocusTree(element)
  const radios = Array.from(tree.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    .filter((radio) =>
      radio.name === element.name &&
      radio.form === element.form &&
      getFocusTree(radio) === tree &&
      isFocusable(radio),
    )
  const checked = radios.find((radio) => radio.checked)
  return !checked || checked === element
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
  return getFocusable(container).filter((element) => {
    const tabindex = element.getAttribute('tabindex')
    return (tabindex === null || Number(tabindex) >= 0) && isRadioTabbable(element)
  })
}
