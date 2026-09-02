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
    const view = current.ownerDocument.defaultView
    const style = view?.getComputedStyle(current)
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') {
      return false
    }
  }
  return true
}

function isDisabledByFieldset(element: HTMLElement): boolean {
  if (!element.matches('button, input, select, textarea, option, optgroup')) return false
  const fieldset = element.closest('fieldset[disabled]')
  if (!fieldset) return false
  const firstLegend = Array.from(fieldset.children).find((child) => child.tagName === 'LEGEND')
  return !(firstLegend instanceof HTMLElement && firstLegend.contains(element))
}

function isFocusable(element: HTMLElement): boolean {
  if (element.matches(':disabled') || isDisabledByFieldset(element)) return false
  return isVisible(element) && !isInert(element)
}

function isRadioTabbable(element: HTMLElement): boolean {
  const Input = element.ownerDocument.defaultView?.HTMLInputElement
  if (!Input || !(element instanceof Input) || element.type !== 'radio' || !element.name) return true
  const scope = element.form ?? element.ownerDocument
  const radios = Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    .filter((radio) => radio.name === element.name && isFocusable(radio))
  const checked = radios.find((radio) => radio.checked)
  return !checked || checked === element
}

export function getFocusable(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable)
}

export function getTabbables(container: ParentNode): HTMLElement[] {
  return getFocusable(container).filter((element) => {
    const tabindex = element.getAttribute('tabindex')
    return (tabindex === null || Number(tabindex) >= 0) && isRadioTabbable(element)
  })
}
