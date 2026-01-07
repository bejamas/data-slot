import { getParts, getRoots, getPart } from '../core/parts.ts'
import { setAria, ensureId } from '../core/aria.ts'
import { on, emit } from '../core/events.ts'

export interface AccordionOptions {
  /** Allow multiple items open at once */
  multiple?: boolean
  /** Initially expanded item(s) */
  defaultValue?: string | string[]
  /** Callback when expanded items change */
  onValueChange?: (value: string[]) => void
  /** Whether items can be fully collapsed (only applies to single mode) */
  collapsible?: boolean
}

export interface AccordionController {
  /** Expand an item by value */
  expand(value: string): void
  /** Collapse an item by value */
  collapse(value: string): void
  /** Toggle an item by value */
  toggle(value: string): void
  /** Currently expanded values */
  readonly value: string[]
  /** Cleanup all event listeners */
  destroy(): void
}

/**
 * Create an accordion controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="accordion">
 *   <div data-slot="accordion-item" data-value="one">
 *     <button data-slot="accordion-trigger">Item One</button>
 *     <div data-slot="accordion-content">Content One</div>
 *   </div>
 *   <div data-slot="accordion-item" data-value="two">
 *     <button data-slot="accordion-trigger">Item Two</button>
 *     <div data-slot="accordion-content">Content Two</div>
 *   </div>
 * </div>
 * ```
 */
export function createAccordion(
  root: Element,
  options: AccordionOptions = {}
): AccordionController {
  const {
    multiple = false,
    onValueChange,
    collapsible = true,
  } = options

  const items = getParts<HTMLElement>(root, 'accordion-item')

  if (items.length === 0) {
    throw new Error('Accordion requires at least one accordion-item')
  }

  // Normalize defaultValue to array
  const defaultValue = options.defaultValue
    ? Array.isArray(options.defaultValue)
      ? options.defaultValue
      : [options.defaultValue]
    : []

  let expandedValues = new Set<string>(defaultValue)
  const cleanups: Array<() => void> = []

  // Collect all triggers for keyboard navigation
  const triggers: HTMLElement[] = []

  // Setup each item
  items.forEach((item) => {
    const value = item.dataset['value']
    if (!value) return

    const trigger = getPart<HTMLElement>(item, 'accordion-trigger')
    const content = getPart<HTMLElement>(item, 'accordion-content')

    if (!trigger || !content) return

    triggers.push(trigger)

    // ARIA setup
    const contentId = ensureId(content, 'accordion-content')
    const triggerId = ensureId(trigger, 'accordion-trigger')
    trigger.setAttribute('aria-controls', contentId)
    content.setAttribute('aria-labelledby', triggerId)
    content.setAttribute('role', 'region')

    // Click handler
    cleanups.push(
      on(trigger, 'click', () => {
        const isExpanded = expandedValues.has(value)

        if (isExpanded) {
          // Check if we can collapse
          if (!collapsible && !multiple && expandedValues.size === 1) {
            return // Can't collapse the only open item
          }
          expandedValues.delete(value)
        } else {
          if (multiple) {
            expandedValues.add(value)
          } else {
            expandedValues = new Set([value])
          }
        }

        updateAllItems()
        emit(root, 'accordion:change', { value: [...expandedValues] })
        onValueChange?.([...expandedValues])
      })
    )
  })

  // Keyboard navigation between triggers
  cleanups.push(
    on(root as HTMLElement, 'keydown', (e) => {
      const target = e.target as HTMLElement
      const currentIndex = triggers.indexOf(target)
      if (currentIndex === -1) return

      let nextIndex = currentIndex

      switch (e.key) {
        case 'ArrowDown':
          nextIndex = currentIndex + 1
          if (nextIndex >= triggers.length) nextIndex = 0
          break
        case 'ArrowUp':
          nextIndex = currentIndex - 1
          if (nextIndex < 0) nextIndex = triggers.length - 1
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = triggers.length - 1
          break
        default:
          return
      }

      e.preventDefault()
      triggers[nextIndex]?.focus()
    })
  )

  const updateAllItems = () => {
    items.forEach((item) => {
      const value = item.dataset['value']
      if (!value) return

      const trigger = getPart<HTMLElement>(item, 'accordion-trigger')
      const content = getPart<HTMLElement>(item, 'accordion-content')

      if (!trigger || !content) return

      const isExpanded = expandedValues.has(value)
      setAria(trigger, 'expanded', isExpanded)
      content.hidden = !isExpanded
      item.setAttribute('data-state', isExpanded ? 'open' : 'closed')
    })
  }

  // Initialize state
  updateAllItems()

  const controller: AccordionController = {
    expand: (value: string) => {
      if (expandedValues.has(value)) return

      if (multiple) {
        expandedValues.add(value)
      } else {
        expandedValues = new Set([value])
      }

      updateAllItems()
      emit(root, 'accordion:change', { value: [...expandedValues] })
      onValueChange?.([...expandedValues])
    },
    collapse: (value: string) => {
      if (!expandedValues.has(value)) return
      if (!collapsible && !multiple && expandedValues.size === 1) return

      expandedValues.delete(value)
      updateAllItems()
      emit(root, 'accordion:change', { value: [...expandedValues] })
      onValueChange?.([...expandedValues])
    },
    toggle: (value: string) => {
      if (expandedValues.has(value)) {
        controller.collapse(value)
      } else {
        controller.expand(value)
      }
    },
    get value() {
      return [...expandedValues]
    },
    destroy: () => {
      cleanups.forEach((fn) => fn())
      cleanups.length = 0
    },
  }

  return controller
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>()

/**
 * Find and bind all accordion components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): AccordionController[] {
  const controllers: AccordionController[] = []

  for (const root of getRoots(scope, 'accordion')) {
    if (bound.has(root)) continue
    bound.add(root)
    controllers.push(createAccordion(root))
  }

  return controllers
}

