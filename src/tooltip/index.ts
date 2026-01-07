import { getPart, getRoots } from '../core/parts.ts'
import { ensureId } from '../core/aria.ts'
import { on, emit } from '../core/events.ts'

export interface TooltipOptions {
  /** Delay before showing tooltip (ms) */
  delay?: number
  /** Callback when visibility changes */
  onOpenChange?: (open: boolean) => void
}

export interface TooltipController {
  /** Show the tooltip */
  show(): void
  /** Hide the tooltip */
  hide(): void
  /** Current visibility state */
  readonly isOpen: boolean
  /** Cleanup all event listeners */
  destroy(): void
}

/**
 * Create a tooltip controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="tooltip">
 *   <button data-slot="tooltip-trigger">Hover me</button>
 *   <div data-slot="tooltip-content" role="tooltip">Tooltip text</div>
 * </div>
 * ```
 */
export function createTooltip(
  root: Element,
  options: TooltipOptions = {}
): TooltipController {
  const { delay = 300, onOpenChange } = options

  const trigger = getPart<HTMLElement>(root, 'tooltip-trigger')
  const content = getPart<HTMLElement>(root, 'tooltip-content')

  if (!trigger || !content) {
    throw new Error('Tooltip requires trigger and content slots')
  }

  let isOpen = false
  let showTimeout: ReturnType<typeof setTimeout> | null = null
  const cleanups: Array<() => void> = []

  // ARIA setup
  const contentId = ensureId(content, 'tooltip-content')
  trigger.setAttribute('aria-describedby', contentId)
  content.setAttribute('role', 'tooltip')

  const updateState = (open: boolean) => {
    if (isOpen === open) return

    isOpen = open
    content.hidden = !isOpen
    root.setAttribute('data-state', isOpen ? 'open' : 'closed')

    emit(root, 'tooltip:change', { open: isOpen })
    onOpenChange?.(isOpen)
  }

  const showWithDelay = () => {
    if (showTimeout) return
    showTimeout = setTimeout(() => {
      updateState(true)
      showTimeout = null
    }, delay)
  }

  const hideImmediately = () => {
    if (showTimeout) {
      clearTimeout(showTimeout)
      showTimeout = null
    }
    updateState(false)
  }

  // Initialize state
  content.hidden = true
  root.setAttribute('data-state', 'closed')

  // Mouse events
  cleanups.push(
    on(trigger, 'mouseenter', showWithDelay),
    on(trigger, 'mouseleave', hideImmediately),
    // Focus events
    on(trigger, 'focus', showWithDelay),
    on(trigger, 'blur', hideImmediately)
  )

  // Escape key to hide
  cleanups.push(
    on(document, 'keydown', (e) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        hideImmediately()
      }
    })
  )

  const controller: TooltipController = {
    show: () => {
      if (showTimeout) {
        clearTimeout(showTimeout)
        showTimeout = null
      }
      updateState(true)
    },
    hide: hideImmediately,
    get isOpen() {
      return isOpen
    },
    destroy: () => {
      if (showTimeout) clearTimeout(showTimeout)
      cleanups.forEach((fn) => fn())
      cleanups.length = 0
    },
  }

  return controller
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>()

/**
 * Find and bind all tooltip components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): TooltipController[] {
  const controllers: TooltipController[] = []

  for (const root of getRoots(scope, 'tooltip')) {
    if (bound.has(root)) continue
    bound.add(root)
    controllers.push(createTooltip(root))
  }

  return controllers
}

