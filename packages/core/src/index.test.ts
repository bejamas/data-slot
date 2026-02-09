import { describe, expect, it, beforeEach } from 'bun:test'
import { getPart, getParts, getRoots, getDataBool, getDataNumber, getDataString, getDataEnum } from './index'
import { ensureId, setAria, linkLabelledBy } from './index'
import { on, emit, composeHandlers } from './index'
import { lockScroll, unlockScroll } from './index'
import { containsWithPortals, portalToBody, restorePortal } from './index'
import { computeFloatingPosition, ensureItemVisibleInContainer, focusElement, createDismissLayer, createPortalLifecycle, createPresenceLifecycle, createPositionSync } from './index'
import type { PortalState } from './index'
import { getScrollLockCount, resetScrollLock } from './scroll'

describe('core/parts', () => {
  it('getPart finds a single slot', () => {
    document.body.innerHTML = `
      <div id="root">
        <button data-slot="trigger">Click</button>
        <div data-slot="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = getPart(root, 'trigger')
    expect(trigger).toBeTruthy()
    expect(trigger?.textContent).toBe('Click')
  })

  it('getPart returns null when not found', () => {
    document.body.innerHTML = `<div id="root"></div>`
    const root = document.getElementById('root')!
    expect(getPart(root, 'missing')).toBeNull()
  })

  it('getParts finds multiple slots', () => {
    document.body.innerHTML = `
      <div id="root">
        <button data-slot="item">One</button>
        <button data-slot="item">Two</button>
        <button data-slot="item">Three</button>
      </div>
    `
    const root = document.getElementById('root')!
    const items = getParts(root, 'item')
    expect(items).toHaveLength(3)
  })

  it('getRoots finds all component roots by data-slot', () => {
    document.body.innerHTML = `
      <div data-slot="dialog">Dialog 1</div>
      <div data-slot="tabs">Tabs</div>
      <div data-slot="dialog">Dialog 2</div>
    `
    const dialogs = getRoots(document, 'dialog')
    expect(dialogs).toHaveLength(2)
  })
})

describe('core/getDataBool', () => {
  // Truthy values
  it('returns true for empty string (present attribute)', () => {
    document.body.innerHTML = `<div id="el" data-open></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(true)
  })

  it('returns true for "true"', () => {
    document.body.innerHTML = `<div id="el" data-open="true"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(true)
  })

  it('returns true for "1"', () => {
    document.body.innerHTML = `<div id="el" data-open="1"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(true)
  })

  it('returns true for "yes"', () => {
    document.body.innerHTML = `<div id="el" data-open="yes"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(true)
  })

  it('returns true for "YES" (case insensitive)', () => {
    document.body.innerHTML = `<div id="el" data-open="YES"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(true)
  })

  // Falsy values
  it('returns false for "false"', () => {
    document.body.innerHTML = `<div id="el" data-open="false"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(false)
  })

  it('returns false for "0"', () => {
    document.body.innerHTML = `<div id="el" data-open="0"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(false)
  })

  it('returns false for "no"', () => {
    document.body.innerHTML = `<div id="el" data-open="no"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(false)
  })

  it('returns false for "NO" (case insensitive)', () => {
    document.body.innerHTML = `<div id="el" data-open="NO"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBe(false)
  })

  // Undefined cases
  it('returns undefined when attribute absent', () => {
    document.body.innerHTML = `<div id="el"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBeUndefined()
  })

  it('returns undefined for invalid value', () => {
    document.body.innerHTML = `<div id="el" data-open="maybe"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'open')).toBeUndefined()
  })

  // Key normalization
  it('handles camelCase keys for kebab-case attributes', () => {
    document.body.innerHTML = `<div id="el" data-close-on-escape="false"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'closeOnEscape')).toBe(false)
  })

  it('handles camelCase attributes directly', () => {
    document.body.innerHTML = `<div id="el" data-closeOnEscape="true"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'closeOnEscape')).toBe(true)
  })

  it('prefers kebab-case over camelCase when both present', () => {
    document.body.innerHTML = `<div id="el" data-close-on-escape="false" data-closeOnEscape="true"></div>`
    const el = document.getElementById('el')!
    expect(getDataBool(el, 'closeOnEscape')).toBe(false)
  })
})

describe('core/getDataNumber', () => {
  it('parses valid positive number', () => {
    document.body.innerHTML = `<div id="el" data-delay="500"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'delay')).toBe(500)
  })

  it('parses zero', () => {
    document.body.innerHTML = `<div id="el" data-offset="0"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'offset')).toBe(0)
  })

  it('parses negative numbers', () => {
    document.body.innerHTML = `<div id="el" data-offset="-5"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'offset')).toBe(-5)
  })

  it('parses decimals', () => {
    document.body.innerHTML = `<div id="el" data-scale="1.5"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'scale')).toBe(1.5)
  })

  it('returns undefined when attribute absent', () => {
    document.body.innerHTML = `<div id="el"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'delay')).toBeUndefined()
  })

  it('returns undefined for invalid number', () => {
    document.body.innerHTML = `<div id="el" data-delay="abc"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'delay')).toBeUndefined()
  })

  it('returns undefined for Infinity', () => {
    document.body.innerHTML = `<div id="el" data-delay="Infinity"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'delay')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    document.body.innerHTML = `<div id="el" data-delay=""></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'delay')).toBeUndefined()
  })

  it('handles camelCase keys for kebab-case attributes', () => {
    document.body.innerHTML = `<div id="el" data-side-offset="8"></div>`
    const el = document.getElementById('el')!
    expect(getDataNumber(el, 'sideOffset')).toBe(8)
  })
})

describe('core/getDataString', () => {
  it('returns string value when present', () => {
    document.body.innerHTML = `<div id="el" data-value="hello"></div>`
    const el = document.getElementById('el')!
    expect(getDataString(el, 'value')).toBe('hello')
  })

  it('returns empty string when attribute is empty', () => {
    document.body.innerHTML = `<div id="el" data-value=""></div>`
    const el = document.getElementById('el')!
    expect(getDataString(el, 'value')).toBe('')
  })

  it('returns undefined when attribute absent', () => {
    document.body.innerHTML = `<div id="el"></div>`
    const el = document.getElementById('el')!
    expect(getDataString(el, 'value')).toBeUndefined()
  })

  it('handles camelCase keys for kebab-case attributes', () => {
    document.body.innerHTML = `<div id="el" data-default-value="test"></div>`
    const el = document.getElementById('el')!
    expect(getDataString(el, 'defaultValue')).toBe('test')
  })
})

describe('core/getDataEnum', () => {
  const SIDES = ['top', 'right', 'bottom', 'left'] as const

  it('returns valid enum value', () => {
    document.body.innerHTML = `<div id="el" data-side="top"></div>`
    const el = document.getElementById('el')!
    expect(getDataEnum(el, 'side', SIDES)).toBe('top')
  })

  it('returns undefined for invalid enum value', () => {
    document.body.innerHTML = `<div id="el" data-side="center"></div>`
    const el = document.getElementById('el')!
    expect(getDataEnum(el, 'side', SIDES)).toBeUndefined()
  })

  it('returns undefined when attribute absent', () => {
    document.body.innerHTML = `<div id="el"></div>`
    const el = document.getElementById('el')!
    expect(getDataEnum(el, 'side', SIDES)).toBeUndefined()
  })

  it('is case-sensitive', () => {
    document.body.innerHTML = `<div id="el" data-side="TOP"></div>`
    const el = document.getElementById('el')!
    expect(getDataEnum(el, 'side', SIDES)).toBeUndefined()
  })

  it('handles camelCase keys for kebab-case attributes', () => {
    document.body.innerHTML = `<div id="el" data-preferred-side="left"></div>`
    const el = document.getElementById('el')!
    expect(getDataEnum(el, 'preferredSide', SIDES)).toBe('left')
  })
})

describe('core/precedence pattern', () => {
  it('JS option > data attribute > default (example)', () => {
    document.body.innerHTML = `<div id="el" data-delay="500"></div>`
    const el = document.getElementById('el')!
    const options = { delay: 100 } as { delay?: number }
    const DEFAULT = 300

    // Full precedence chain
    const delay = options.delay ?? getDataNumber(el, 'delay') ?? DEFAULT
    expect(delay).toBe(100) // JS wins

    // Without JS option
    const options2 = {} as { delay?: number }
    const delay2 = options2.delay ?? getDataNumber(el, 'delay') ?? DEFAULT
    expect(delay2).toBe(500) // data-* wins

    // Without either
    document.body.innerHTML = `<div id="el2"></div>`
    const el2 = document.getElementById('el2')!
    const delay3 = options2.delay ?? getDataNumber(el2, 'delay') ?? DEFAULT
    expect(delay3).toBe(300) // default wins
  })
})

describe('core/aria', () => {
  it('ensureId generates an id if missing', () => {
    document.body.innerHTML = `<div id="test"></div><div></div>`
    const withId = document.getElementById('test')!
    const withoutId = document.body.lastElementChild!

    expect(ensureId(withId, 'prefix')).toBe('test')
    const generated = ensureId(withoutId, 'prefix')
    expect(generated).toMatch(/^prefix-\d+$/)
    expect(withoutId.id).toBe(generated)
  })

  it('setAria sets and removes attributes', () => {
    document.body.innerHTML = `<button></button>`
    const btn = document.querySelector('button')!

    setAria(btn, 'expanded', true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')

    setAria(btn, 'expanded', false)
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    setAria(btn, 'label', 'Test')
    expect(btn.getAttribute('aria-label')).toBe('Test')

    setAria(btn, 'label', null)
    expect(btn.hasAttribute('aria-label')).toBe(false)
  })

  it('linkLabelledBy links content to title and description', () => {
    document.body.innerHTML = `
      <div id="content"></div>
      <h2 id="title">Title</h2>
      <p>Description</p>
    `
    const content = document.getElementById('content')!
    const title = document.getElementById('title')!
    const desc = document.querySelector('p')!

    linkLabelledBy(content, title, desc)

    expect(content.getAttribute('aria-labelledby')).toBe('title')
    expect(content.hasAttribute('aria-describedby')).toBe(true)
    expect(desc.id).toBeTruthy()
  })
})

describe('core/events', () => {
  it('on adds and removes event listener', () => {
    document.body.innerHTML = `<button>Click</button>`
    const btn = document.querySelector('button')!

    let clicked = false
    const cleanup = on(btn, 'click', () => {
      clicked = true
    })

    btn.click()
    expect(clicked).toBe(true)

    clicked = false
    cleanup()
    btn.click()
    expect(clicked).toBe(false)
  })

  it('emit dispatches custom event', () => {
    document.body.innerHTML = `<div id="root"></div>`
    const root = document.getElementById('root')!

    let received: unknown = null
    root.addEventListener('test:event', (e) => {
      received = (e as CustomEvent).detail
    })

    emit(root, 'test:event', { foo: 'bar' })
    expect(received).toEqual({ foo: 'bar' })
  })

  it('composeHandlers calls handlers in order', () => {
    const order: number[] = []

    const composed = composeHandlers<Event>(
      () => order.push(1),
      () => order.push(2),
      undefined,
      () => order.push(3)
    )

    composed(new Event('test'))
    expect(order).toEqual([1, 2, 3])
  })

  it('composeHandlers stops on defaultPrevented', () => {
    const order: number[] = []

    const composed = composeHandlers<Event>(
      () => order.push(1),
      (e) => {
        order.push(2)
        e.preventDefault()
      },
      () => order.push(3)
    )

    const event = new Event('test', { cancelable: true })
    composed(event)
    expect(order).toEqual([1, 2])
  })
})

describe('core/scroll', () => {
  beforeEach(() => {
    resetScrollLock()
    document.documentElement.style.cssText = ''
  })

  it('lockScroll sets overflow hidden on html', () => {
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
  })

  it('lockScroll sets scrollbar-gutter to stable', () => {
    lockScroll()
    expect(document.documentElement.style.scrollbarGutter).toBe('stable')
    unlockScroll()
    expect(document.documentElement.style.scrollbarGutter).toBe('')
  })

  it('unlockScroll restores html overflow', () => {
    document.documentElement.style.overflow = 'auto'
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('auto')
  })

  it('uses reference counting for nested overlays', () => {
    lockScroll()
    expect(getScrollLockCount()).toBe(1)
    lockScroll()
    expect(getScrollLockCount()).toBe(2)
    expect(document.documentElement.style.overflow).toBe('hidden')

    unlockScroll()
    expect(getScrollLockCount()).toBe(1)
    expect(document.documentElement.style.overflow).toBe('hidden') // Still locked

    unlockScroll()
    expect(getScrollLockCount()).toBe(0)
    expect(document.documentElement.style.overflow).toBe('') // Now unlocked
  })

  it('unlockScroll does not go below zero', () => {
    unlockScroll()
    unlockScroll()
    expect(getScrollLockCount()).toBe(0)
  })

  it('resetScrollLock clears all state', () => {
    lockScroll()
    lockScroll()
    expect(getScrollLockCount()).toBe(2)

    resetScrollLock()
    expect(getScrollLockCount()).toBe(0)
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.documentElement.style.scrollbarGutter).toBe('')
  })

  it('handles multiple independent lock/unlock cycles (simulates nested overlays)', () => {
    // Simulates: dialog opens, dropdown opens inside, dropdown closes, dialog closes
    // This pattern is tested end-to-end in component tests; here we verify the core ref counting

    // "Dialog" opens
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(getScrollLockCount()).toBe(1)

    // "Dropdown" opens while dialog is open
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(getScrollLockCount()).toBe(2)

    // "Dropdown" closes - dialog still open, should stay locked
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(getScrollLockCount()).toBe(1)

    // "Dialog" closes - all closed, should unlock
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('')
    expect(getScrollLockCount()).toBe(0)
  })
})

describe('core/portal', () => {
  const makeState = (): PortalState => ({
    originalParent: null,
    originalNextSibling: null,
    portaled: false,
  })

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('portalToBody moves element to body and tracks state', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const state = makeState()

    portalToBody(content, root, state)

    expect(content.parentElement).toBe(document.body)
    expect(state.portaled).toBe(true)
    expect(state.originalParent).toBe(root)
  })

  it('restorePortal returns element to original position', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
        <div id="sibling">Sibling</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const sibling = document.getElementById('sibling')!
    const state = makeState()

    portalToBody(content, root, state)
    expect(content.parentElement).toBe(document.body)

    restorePortal(content, state)
    expect(content.parentElement).toBe(root)
    // Content should appear before sibling (nextElementSibling ignores text nodes)
    expect(content.nextElementSibling).toBe(sibling)
    expect(state.portaled).toBe(false)
  })

  it('restorePortal with removed sibling falls back to appendChild', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
        <div id="sibling">Sibling</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const state = makeState()

    portalToBody(content, root, state)

    // Remove the sibling while portaled
    document.getElementById('sibling')!.remove()

    restorePortal(content, state)
    expect(content.parentElement).toBe(root)
    // Should be last child since sibling was removed
    expect(root.lastElementChild).toBe(content)
  })

  it('restorePortal with disconnected parent removes element', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const state = makeState()

    portalToBody(content, root, state)

    // Disconnect the original parent
    root.remove()

    restorePortal(content, state)
    // Element should be removed from DOM entirely
    expect(content.parentElement).toBeNull()
  })

  it('containsWithPortals returns true for direct child', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="child">Child</div>
      </div>
    `
    const root = document.getElementById('root')!
    const child = document.getElementById('child')!

    expect(containsWithPortals(root, child)).toBe(true)
  })

  it('containsWithPortals returns true for portaled element whose owner is inside root', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const state = makeState()

    portalToBody(content, root, state)

    // content is now in body, but its owner (root) is root — so clicking content
    // should be recognized as inside root
    expect(containsWithPortals(root, content)).toBe(true)

    restorePortal(content, state)
  })

  it('containsWithPortals returns false for unrelated portaled element', () => {
    document.body.innerHTML = `
      <div id="root1">
        <div id="content1">Content 1</div>
      </div>
      <div id="root2">
        <div id="content2">Content 2</div>
      </div>
    `
    const root1 = document.getElementById('root1')!
    const content2 = document.getElementById('content2')!
    const root2 = document.getElementById('root2')!
    const state = makeState()

    portalToBody(content2, root2, state)

    expect(containsWithPortals(root1, content2)).toBe(false)

    restorePortal(content2, state)
  })

  it('containsWithPortals handles chained portals (nested)', () => {
    document.body.innerHTML = `
      <div id="popover-root">
        <div id="select-root">
          <div id="select-content">Select Content</div>
        </div>
      </div>
    `
    const popoverRoot = document.getElementById('popover-root')!
    const selectRoot = document.getElementById('select-root')!
    const selectContent = document.getElementById('select-content')!
    const state = makeState()

    // Select content portaled to body, owner is selectRoot which is inside popoverRoot
    portalToBody(selectContent, selectRoot, state)

    expect(containsWithPortals(popoverRoot, selectContent)).toBe(true)

    restorePortal(selectContent, state)
  })

  it('containsWithPortals handles null target', () => {
    document.body.innerHTML = `<div id="root"></div>`
    const root = document.getElementById('root')!

    expect(containsWithPortals(root, null)).toBe(false)
  })

  it('containsWithPortals recognizes owner set via shared symbol marker', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!

    // Simulate ownership written by another bundled copy of core
    ;(content as Element & { [key: symbol]: Element })[Symbol.for('data-slot.portal-owner')] = root
    document.body.appendChild(content)

    expect(containsWithPortals(root, content)).toBe(true)
  })

  it('portalToBody is idempotent when already portaled', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const state = makeState()

    portalToBody(content, root, state)
    const parentAfterFirst = content.parentElement

    // Calling again should be a no-op
    portalToBody(content, root, state)
    expect(content.parentElement).toBe(parentAfterFirst)

    restorePortal(content, state)
  })

  it('restorePortal is idempotent when not portaled', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const state = makeState()

    // Should be a no-op
    restorePortal(content, state)
    expect(content.parentElement).toBe(root)
  })
})

describe('core/popup', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    }) as DOMRect

  const waitForRaf = () => new Promise((resolve) => setTimeout(resolve, 20))

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('computeFloatingPosition returns preferred side when it fits', () => {
    const pos = computeFloatingPosition({
      anchorRect: rect(100, 100, 60, 30),
      contentRect: rect(0, 0, 80, 40),
      side: 'bottom',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      avoidCollisions: true,
      collisionPadding: 8,
      viewportWidth: 800,
      viewportHeight: 600,
    })

    expect(pos.side).toBe('bottom')
    expect(pos.align).toBe('start')
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(134)
  })

  it('computeFloatingPosition flips to opposite side on overflow', () => {
    const pos = computeFloatingPosition({
      anchorRect: rect(100, 580, 60, 20),
      contentRect: rect(0, 0, 120, 120),
      side: 'bottom',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      avoidCollisions: true,
      collisionPadding: 8,
      viewportWidth: 800,
      viewportHeight: 700,
      allowedSides: ['top', 'bottom'],
    })

    expect(pos.side).toBe('top')
    expect(pos.y).toBe(456)
  })

  it('computeFloatingPosition clamps to viewport when collisions enabled', () => {
    const pos = computeFloatingPosition({
      anchorRect: rect(390, 250, 20, 20),
      contentRect: rect(0, 0, 160, 80),
      side: 'right',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      avoidCollisions: true,
      collisionPadding: 10,
      viewportWidth: 420,
      viewportHeight: 320,
    })

    expect(pos.side).toBe('top')
    expect(pos.x).toBe(250)
    expect(pos.y).toBe(166)
  })

  it('computeFloatingPosition selects the first allowed side that fits', () => {
    const pos = computeFloatingPosition({
      anchorRect: rect(180, 170, 20, 20),
      contentRect: rect(0, 0, 120, 80),
      side: 'right',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      avoidCollisions: true,
      collisionPadding: 8,
      viewportWidth: 220,
      viewportHeight: 220,
      allowedSides: ['right', 'bottom', 'left'],
    })

    expect(pos.side).toBe('left')
  })

  it('computeFloatingPosition uses least-overflow side when none fit', () => {
    const pos = computeFloatingPosition({
      anchorRect: rect(10, 30, 20, 20),
      contentRect: rect(0, 0, 120, 90),
      side: 'left',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      avoidCollisions: true,
      collisionPadding: 8,
      viewportWidth: 140,
      viewportHeight: 100,
      allowedSides: ['left', 'right'],
    })

    expect(pos.side).toBe('right')
  })

  it('computeFloatingPosition uses visualViewport offsets while clamping', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const fakeVisualViewport = {
      width: 300,
      height: 200,
      offsetLeft: 100,
      offsetTop: 50,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true
      },
    } as unknown as VisualViewport

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: fakeVisualViewport,
    })

    try {
      const pos = computeFloatingPosition({
        anchorRect: rect(90, 60, 20, 20),
        contentRect: rect(0, 0, 120, 80),
        side: 'bottom',
        align: 'start',
        sideOffset: 4,
        alignOffset: 0,
        avoidCollisions: true,
        collisionPadding: 10,
        allowedSides: ['bottom'],
      })

      expect(pos.side).toBe('bottom')
      expect(pos.x).toBe(110)
      expect(pos.y).toBe(84)
    } finally {
      if (original) {
        Object.defineProperty(window, 'visualViewport', original)
      } else {
        Reflect.deleteProperty(window as Window & Record<string, unknown>, 'visualViewport')
      }
    }
  })

  it('ensureItemVisibleInContainer does not scroll when item is already visible', () => {
    document.body.innerHTML = `
      <div id="container">
        <div id="item"></div>
      </div>
    `
    const container = document.getElementById('container') as HTMLElement
    const item = document.getElementById('item') as HTMLElement

    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 400 })
    container.scrollTop = 40

    container.getBoundingClientRect = () => rect(0, 0, 200, 100)
    item.getBoundingClientRect = () => rect(0, 20, 200, 20)

    ensureItemVisibleInContainer(item, container)
    expect(container.scrollTop).toBe(40)
  })

  it('ensureItemVisibleInContainer scrolls down when item is below viewport', () => {
    document.body.innerHTML = `
      <div id="container">
        <div id="item"></div>
      </div>
    `
    const container = document.getElementById('container') as HTMLElement
    const item = document.getElementById('item') as HTMLElement

    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 400 })
    container.scrollTop = 0

    container.getBoundingClientRect = () => rect(0, 0, 200, 100)
    item.getBoundingClientRect = () => rect(0, 140, 200, 30)

    ensureItemVisibleInContainer(item, container)
    expect(container.scrollTop).toBe(74)
  })

  it('ensureItemVisibleInContainer scrolls up when item is above viewport', () => {
    document.body.innerHTML = `
      <div id="container">
        <div id="item"></div>
      </div>
    `
    const container = document.getElementById('container') as HTMLElement
    const item = document.getElementById('item') as HTMLElement

    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 400 })
    container.scrollTop = 80

    container.getBoundingClientRect = () => rect(0, 0, 200, 100)
    item.getBoundingClientRect = () => rect(0, -40, 200, 20)

    ensureItemVisibleInContainer(item, container)
    expect(container.scrollTop).toBe(36)
  })

  it('createPositionSync updates from ancestor scroll', async () => {
    document.body.innerHTML = `
      <div id="outer" style="overflow: auto; max-height: 100px;">
        <div style="height: 300px;">
          <div id="anchor"></div>
        </div>
      </div>
    `
    const outer = document.getElementById('outer')!
    const anchor = document.getElementById('anchor')!
    let updates = 0

    const sync = createPositionSync({
      observedElements: [anchor],
      onUpdate: () => {
        updates += 1
      },
    })

    sync.start()
    outer.dispatchEvent(new Event('scroll'))
    await waitForRaf()
    expect(updates).toBe(1)
    sync.stop()
  })

  it('createPositionSync honors ignoreScrollTarget', async () => {
    document.body.innerHTML = `
      <div id="content" style="overflow: auto; max-height: 100px;">
        <div style="height: 300px;"></div>
      </div>
    `
    const content = document.getElementById('content')!
    let updates = 0

    const sync = createPositionSync({
      observedElements: [content],
      onUpdate: () => {
        updates += 1
      },
      ignoreScrollTarget: (target) => target === content,
    })

    sync.start()
    content.dispatchEvent(new Event('scroll'))
    await waitForRaf()
    expect(updates).toBe(0)
    sync.stop()
  })

  it('createPositionSync can disable ancestor scroll listeners', async () => {
    document.body.innerHTML = `
      <div id="outer" style="overflow: auto; max-height: 100px;">
        <div style="height: 300px;">
          <div id="anchor"></div>
        </div>
      </div>
    `
    const outer = document.getElementById('outer')!
    const anchor = document.getElementById('anchor')!
    let updates = 0

    const sync = createPositionSync({
      observedElements: [anchor],
      ancestorScroll: false,
      onUpdate: () => {
        updates += 1
      },
    })

    sync.start()
    outer.dispatchEvent(new Event('scroll'))
    await waitForRaf()
    expect(updates).toBe(0)
    sync.stop()
  })

  it('createDismissLayer dismisses on outside pointerdown but not on portaled inside click', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content"></div>
      </div>
      <div id="outside"></div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const outside = document.getElementById('outside')!

    const lifecycle = createPortalLifecycle({ content, root })
    lifecycle.mount()

    let open = true
    let dismissed = 0
    const cleanup = createDismissLayer({
      root,
      isOpen: () => open,
      onDismiss: () => {
        dismissed += 1
        open = false
      },
      closeOnEscape: false,
    })

    content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(dismissed).toBe(0)

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(dismissed).toBe(1)

    cleanup()
    lifecycle.cleanup()
  })

  it('createDismissLayer dismisses only the topmost open layer on Escape', () => {
    document.body.innerHTML = `
      <div id="outer">
        <button id="inner"></button>
      </div>
    `
    const outer = document.getElementById('outer')!
    const inner = document.getElementById('inner')!

    let outerOpen = true
    let innerOpen = true
    let outerDismissed = 0
    let innerDismissed = 0

    const cleanupOuter = createDismissLayer({
      root: outer,
      isOpen: () => outerOpen,
      onDismiss: () => {
        outerDismissed += 1
        outerOpen = false
      },
      closeOnClickOutside: false,
      closeOnEscape: true,
    })

    const cleanupInner = createDismissLayer({
      root: inner,
      isOpen: () => innerOpen,
      onDismiss: () => {
        innerDismissed += 1
        innerOpen = false
      },
      closeOnClickOutside: false,
      closeOnEscape: true,
    })

    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(innerDismissed).toBe(1)
    expect(outerDismissed).toBe(0)

    cleanupInner()
    cleanupOuter()
  })

  it('createDismissLayer respects Escape already handled by inner control', () => {
    document.body.innerHTML = `
      <div id="root">
        <input id="input" />
      </div>
    `
    const root = document.getElementById('root')!
    const input = document.getElementById('input')!

    let open = true
    let dismissed = 0

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') e.preventDefault()
    })

    const cleanup = createDismissLayer({
      root,
      isOpen: () => open,
      onDismiss: () => {
        dismissed += 1
        open = false
      },
      closeOnClickOutside: false,
      closeOnEscape: true,
    })

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(dismissed).toBe(0)

    cleanup()
  })

  it('createDismissLayer dismisses only one topmost layer on outside pointerdown', () => {
    document.body.innerHTML = `
      <div id="outer">
        <div id="inner"></div>
      </div>
      <div id="outside"></div>
    `
    const outer = document.getElementById('outer')!
    const inner = document.getElementById('inner')!
    const outside = document.getElementById('outside')!

    let outerOpen = true
    let innerOpen = true
    let outerDismissed = 0
    let innerDismissed = 0

    const cleanupOuter = createDismissLayer({
      root: outer,
      isOpen: () => outerOpen,
      onDismiss: () => {
        outerDismissed += 1
        outerOpen = false
      },
      closeOnClickOutside: true,
      closeOnEscape: false,
    })

    const cleanupInner = createDismissLayer({
      root: inner,
      isOpen: () => innerOpen,
      onDismiss: () => {
        innerDismissed += 1
        innerOpen = false
      },
      closeOnClickOutside: true,
      closeOnEscape: false,
    })

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(innerDismissed).toBe(1)
    expect(outerDismissed).toBe(0)

    cleanupInner()
    cleanupOuter()
  })

  it('focusElement prefers preventScroll when available', () => {
    document.body.innerHTML = `<button id="btn">Button</button>`
    const btn = document.getElementById('btn') as HTMLButtonElement
    const calls: unknown[][] = []

    const originalFocus = btn.focus.bind(btn)
    ;(btn as HTMLButtonElement & { focus: (...args: unknown[]) => void }).focus = (...args: unknown[]) => {
      calls.push(args)
    }

    try {
      focusElement(btn)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual([{ preventScroll: true }])
    } finally {
      ;(btn as HTMLButtonElement & { focus: (...args: unknown[]) => void }).focus = originalFocus as unknown as (
        ...args: unknown[]
      ) => void
    }
  })

  it('focusElement falls back to plain focus when options are unsupported', () => {
    document.body.innerHTML = `<button id="btn">Button</button>`
    const btn = document.getElementById('btn') as HTMLButtonElement
    const calls: unknown[][] = []

    const originalFocus = btn.focus.bind(btn)
    ;(btn as HTMLButtonElement & { focus: (...args: unknown[]) => void }).focus = (...args: unknown[]) => {
      calls.push(args)
      if (args.length > 0) {
        throw new TypeError('focus options not supported')
      }
    }

    try {
      focusElement(btn)
      expect(calls).toHaveLength(2)
      expect(calls[0]).toEqual([{ preventScroll: true }])
      expect(calls[1]).toEqual([])
    } finally {
      ;(btn as HTMLButtonElement & { focus: (...args: unknown[]) => void }).focus = originalFocus as unknown as (
        ...args: unknown[]
      ) => void
    }
  })

  it('createPortalLifecycle mounts and restores content', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content"></div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const lifecycle = createPortalLifecycle({ content, root })

    lifecycle.mount()
    expect(content.parentElement).toBe(document.body)

    lifecycle.restore()
    expect(content.parentElement).toBe(root)

    lifecycle.cleanup()
    expect(content.parentElement).toBe(root)
  })

  it('createPortalLifecycle supports wrapper slot for positioner-style portaling', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="content"></div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.getElementById('content')!
    const lifecycle = createPortalLifecycle({
      content,
      root,
      wrapperSlot: 'popover-positioner',
    })

    expect(lifecycle.container).toBe(content)

    lifecycle.mount()
    const wrapper = content.parentElement as HTMLElement | null
    expect(wrapper).toBeTruthy()
    expect(wrapper?.getAttribute('data-slot')).toBe('popover-positioner')
    expect(wrapper?.style.isolation).toBe('isolate')
    expect(wrapper?.style.zIndex).toBe('50')
    expect(wrapper?.parentElement).toBe(document.body)
    expect(lifecycle.container).toBe(wrapper)

    lifecycle.restore()
    expect(content.parentElement).toBe(root)
    expect(lifecycle.container).toBe(content)
  })

  it('createPortalLifecycle supports authored container + mount target', () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-slot="popover-portal" id="portal">
          <div data-slot="popover-positioner" id="positioner">
            <div id="content"></div>
          </div>
        </div>
      </div>
    `
    const root = document.getElementById('root')!
    const portal = document.getElementById('portal')!
    const positioner = document.getElementById('positioner')!
    const content = document.getElementById('content')!
    const lifecycle = createPortalLifecycle({
      content,
      root,
      container: positioner,
      mountTarget: portal,
    })

    expect(lifecycle.container).toBe(positioner)
    lifecycle.mount()
    expect(portal.parentElement).toBe(document.body)
    expect(positioner.parentElement).toBe(portal)
    expect(content.parentElement).toBe(positioner)
    expect(lifecycle.container).toBe(positioner)

    lifecycle.restore()
    expect(portal.parentElement).toBe(root)
    expect(positioner.parentElement).toBe(portal)
    expect(content.parentElement).toBe(positioner)
    expect(lifecycle.container).toBe(positioner)
  })

  it('createPresenceLifecycle toggles starting/ending style markers and completes exit', async () => {
    document.body.innerHTML = `<div id="content"></div>`
    const content = document.getElementById('content') as HTMLElement
    const originalGetComputedStyle = window.getComputedStyle
    let exited = 0

    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: ((el: Element) => {
        const style = originalGetComputedStyle.call(window, el)
        return Object.assign({}, style, {
          transitionDuration: '50ms',
          transitionDelay: '0s',
          animationDuration: '0s',
          animationDelay: '0s',
        }) as CSSStyleDeclaration
      }) as typeof window.getComputedStyle,
    })

    try {
      const presence = createPresenceLifecycle({
        element: content,
        onExitComplete: () => {
          exited += 1
        },
      })

      presence.enter()
      expect(content.hasAttribute('data-starting-style')).toBe(true)

      await waitForRaf()
      expect(content.hasAttribute('data-starting-style')).toBe(false)

      presence.exit()
      expect(content.hasAttribute('data-ending-style')).toBe(true)
      content.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true }))

      expect(exited).toBe(1)
      expect(content.hasAttribute('data-ending-style')).toBe(false)

      presence.cleanup()
    } finally {
      Object.defineProperty(window, 'getComputedStyle', {
        configurable: true,
        value: originalGetComputedStyle,
      })
    }
  })

  it('createPresenceLifecycle unmounts on next frame when no exit animation exists', async () => {
    document.body.innerHTML = `<div id="content"></div>`
    const content = document.getElementById('content') as HTMLElement
    const originalGetComputedStyle = window.getComputedStyle
    let exited = 0

    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: ((el: Element) => {
        const style = originalGetComputedStyle.call(window, el)
        return Object.assign({}, style, {
          transitionDuration: '0s',
          transitionDelay: '0s',
          animationDuration: '0s',
          animationDelay: '0s',
        }) as CSSStyleDeclaration
      }) as typeof window.getComputedStyle,
    })

    try {
      const presence = createPresenceLifecycle({
        element: content,
        onExitComplete: () => {
          exited += 1
        },
      })

      presence.exit()
      expect(content.hasAttribute('data-ending-style')).toBe(true)
      await waitForRaf()

      expect(exited).toBe(1)
      expect(content.hasAttribute('data-ending-style')).toBe(false)
      presence.cleanup()
    } finally {
      Object.defineProperty(window, 'getComputedStyle', {
        configurable: true,
        value: originalGetComputedStyle,
      })
    }
  })

  it('createPresenceLifecycle cancels pending exit when reopened', async () => {
    document.body.innerHTML = `<div id="content"></div>`
    const content = document.getElementById('content') as HTMLElement
    const originalGetComputedStyle = window.getComputedStyle
    let exited = 0

    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: ((el: Element) => {
        const style = originalGetComputedStyle.call(window, el)
        return Object.assign({}, style, {
          transitionDuration: '120ms',
          transitionDelay: '0s',
          animationDuration: '0s',
          animationDelay: '0s',
        }) as CSSStyleDeclaration
      }) as typeof window.getComputedStyle,
    })

    try {
      const presence = createPresenceLifecycle({
        element: content,
        onExitComplete: () => {
          exited += 1
        },
      })

      presence.exit()
      expect(presence.isExiting).toBe(true)
      presence.enter()
      expect(presence.isExiting).toBe(false)
      expect(content.hasAttribute('data-ending-style')).toBe(false)

      await new Promise((resolve) => setTimeout(resolve, 170))
      expect(exited).toBe(0)
      presence.cleanup()
    } finally {
      Object.defineProperty(window, 'getComputedStyle', {
        configurable: true,
        value: originalGetComputedStyle,
      })
    }
  })
})
