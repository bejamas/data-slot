import { describe, expect, it } from 'bun:test'
import { createPopover, create } from './index'
import { portalToBody, restorePortal } from '@data-slot/core'
import type { PortalState } from '@data-slot/core'

describe('Popover', () => {
  const setup = (options: Parameters<typeof createPopover>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="popover" id="root">
        <button data-slot="popover-trigger">Open</button>
        <div data-slot="popover-content">
          Popover content
          <button data-slot="popover-close">Close</button>
        </div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="popover-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="popover-content"]') as HTMLElement
    const closeBtn = document.querySelector('[data-slot="popover-close"]') as HTMLElement
    const controller = createPopover(root, options)

    return { root, trigger, content, closeBtn, controller }
  }

  it('initializes with content hidden', () => {
    const { content, controller } = setup()

    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('opens on trigger click', () => {
    const { trigger, content, controller } = setup()

    trigger.click()
    expect(content.hidden).toBe(false)
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('closes on close button click', () => {
    const { trigger, content, closeBtn, controller } = setup()

    trigger.click()
    expect(content.hidden).toBe(false)

    closeBtn.click()
    expect(content.hidden).toBe(true)

    controller.destroy()
  })

  it('toggles on trigger click', () => {
    const { trigger, controller } = setup()

    trigger.click()
    expect(controller.isOpen).toBe(true)

    trigger.click()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('closes on click outside', () => {
    const { trigger, controller } = setup()

    trigger.click()
    expect(controller.isOpen).toBe(true)

    // Click outside
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('respects closeOnClickOutside option', () => {
    const { trigger, controller } = setup({ closeOnClickOutside: false })

    trigger.click()
    expect(controller.isOpen).toBe(true)

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('closes on Escape key', () => {
    const { trigger, controller } = setup()

    trigger.click()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('respects closeOnEscape option', () => {
    const { trigger, controller } = setup({ closeOnEscape: false })

    trigger.click()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('sets ARIA attributes correctly', () => {
    const { trigger, content, controller } = setup()

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-controls')).toBe(content.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    controller.open()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    controller.destroy()
  })

  it('sets data-state on root and content', () => {
    const { root, content, controller } = setup()

    expect(root.getAttribute('data-state')).toBe('closed')
    expect(content.getAttribute('data-state')).toBe('closed')

    controller.open()
    expect(root.getAttribute('data-state')).toBe('open')
    expect(content.getAttribute('data-state')).toBe('open')

    controller.close()
    expect(root.getAttribute('data-state')).toBe('closed')
    expect(content.getAttribute('data-state')).toBe('closed')

    controller.destroy()
  })

  it('emits popover:change event', () => {
    const { root, controller } = setup()

    let lastOpen: boolean | undefined
    root.addEventListener('popover:change', (e) => {
      lastOpen = (e as CustomEvent).detail.open
    })

    controller.open()
    expect(lastOpen).toBe(true)

    controller.close()
    expect(lastOpen).toBe(false)

    controller.destroy()
  })

  it('calls onOpenChange callback', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <button data-slot="popover-trigger">Open</button>
      <div data-slot="popover-content">Content</div>
    `
    document.body.appendChild(root)

    let lastOpen: boolean | undefined
    const controller = createPopover(root, {
      onOpenChange: (open) => {
        lastOpen = open
      },
    })

    controller.open()
    expect(lastOpen).toBe(true)

    controller.toggle()
    expect(lastOpen).toBe(false)

    controller.destroy()
  })

  it('create binds all popover components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="popover">
        <button data-slot="popover-trigger">Open</button>
        <div data-slot="popover-content">Content</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(1)
    
    const trigger = document.querySelector('[data-slot="popover-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="popover-content"]') as HTMLElement

    expect(content.hidden).toBe(true)
    trigger.click()
    expect(content.hidden).toBe(false)

    // Can control programmatically
    controllers[0]?.close()
    expect(content.hidden).toBe(true)

    controllers.forEach(c => c.destroy())
  })

  describe('inbound events', () => {
    it('popover:set with { open } controls state', () => {
      const { root, controller } = setup()

      root.dispatchEvent(new CustomEvent('popover:set', { detail: { open: true } }))
      expect(controller.isOpen).toBe(true)

      root.dispatchEvent(new CustomEvent('popover:set', { detail: { open: false } }))
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it('supports deprecated popover:set { value } shape', () => {
      const { root, controller } = setup()

      root.dispatchEvent(new CustomEvent('popover:set', { detail: { value: true } }))
      expect(controller.isOpen).toBe(true)

      root.dispatchEvent(new CustomEvent('popover:set', { detail: { value: false } }))
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })
  })

  describe('content positioning', () => {
    it('uses fixed positioning when open', () => {
      const { content, controller } = setup()

      controller.open()
      expect(content.style.position).toBe('fixed')
      expect(content.style.top).not.toBe('')
      expect(content.style.left).not.toBe('')

      controller.destroy()
    })

    it('sets data-side and data-align attributes when open', () => {
      const { content, controller } = setup()

      controller.open()
      expect(content.getAttribute('data-side')).toBe('bottom')
      expect(content.getAttribute('data-align')).toBe('center')

      controller.destroy()
    })

    it('respects side option', () => {
      const { content, controller } = setup({ side: 'top', avoidCollisions: false })

      controller.open()
      expect(content.getAttribute('data-side')).toBe('top')

      controller.destroy()
    })

    it('respects align option', () => {
      const { content, controller } = setup({ align: 'end', avoidCollisions: false })

      controller.open()
      expect(content.getAttribute('data-align')).toBe('end')

      controller.destroy()
    })

    it('supports deprecated position option as a side alias', () => {
      const { content, controller } = setup({ position: 'left', avoidCollisions: false })

      controller.open()
      expect(content.getAttribute('data-side')).toBe('left')
      expect(content.getAttribute('data-position')).toBe('left')

      controller.destroy()
    })
  })

  // Focus management tests
  describe('focus management', () => {
    it('focuses first focusable element on open', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">
            <input type="text" id="first-input" />
            <input type="text" id="second-input" />
          </div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createPopover(root)
      const input = document.getElementById('first-input') as HTMLInputElement

      controller.open()

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          expect(document.activeElement).toBe(input)
          controller.destroy()
          resolve()
        })
      })
    })

    it('focuses [autofocus] element on open', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">
            <input type="text" id="first-input" />
            <input type="text" id="auto-input" autofocus />
          </div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createPopover(root)
      const autoInput = document.getElementById('auto-input') as HTMLInputElement

      controller.open()

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          expect(document.activeElement).toBe(autoInput)
          controller.destroy()
          resolve()
        })
      })
    })

    it('focuses content when no focusable elements', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">
            <p>Just text, no focusable elements</p>
          </div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="popover-content"]') as HTMLElement
      const controller = createPopover(root)

      controller.open()

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          expect(document.activeElement).toBe(content)
          expect(content.getAttribute('tabindex')).toBe('-1')
          controller.destroy()
          resolve()
        })
      })
    })

    it('restores focus to previous element on close', () => {
      document.body.innerHTML = `
        <button id="outside-btn">Outside</button>
        <div data-slot="popover" id="root">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">
            <input type="text" />
          </div>
        </div>
      `
      const root = document.getElementById('root')!
      const trigger = root.querySelector('[data-slot="popover-trigger"]') as HTMLElement
      const controller = createPopover(root)

      // Focus the trigger, then open
      trigger.focus()
      expect(document.activeElement).toBe(trigger)

      controller.open()

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          // Now close
          controller.close()

          requestAnimationFrame(() => {
            expect(document.activeElement).toBe(trigger)
            controller.destroy()
            resolve()
          })
        })
      })
    })
  })

  // Data attribute tests
  describe('data attributes', () => {
    it("data-close-on-escape='false' disables Escape key closing", () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root" data-close-on-escape="false">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createPopover(root)

      controller.open()
      expect(controller.isOpen).toBe(true)

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it("data-close-on-click-outside='false' disables click outside closing", () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root" data-close-on-click-outside="false">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createPopover(root)

      controller.open()
      expect(controller.isOpen).toBe(true)

      document.body.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      )
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it("data-default-open opens popover initially", () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root" data-default-open>
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createPopover(root)

      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root" data-close-on-escape="false">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      // JS option says true, data attribute says false - JS wins
      const controller = createPopover(root, { closeOnEscape: true })

      controller.open()
      expect(controller.isOpen).toBe(true)

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it('reads data-side and data-align from content first, then root', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root" data-side="top" data-align="end" data-avoid-collisions="false">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content" data-side="right" data-align="start">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="popover-content"]') as HTMLElement
      const controller = createPopover(root)

      controller.open()
      expect(content.getAttribute('data-side')).toBe('right')
      expect(content.getAttribute('data-align')).toBe('start')

      controller.destroy()
    })

    it('falls back to deprecated data-position when data-side is absent', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root" data-position="left" data-avoid-collisions="false">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="popover-content"]') as HTMLElement
      const controller = createPopover(root)

      controller.open()
      expect(content.getAttribute('data-side')).toBe('left')
      expect(content.getAttribute('data-position')).toBe('left')

      controller.destroy()
    })
  })

  describe('portal-aware click-outside', () => {
    it('does not close popover when clicking portaled child content', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">
            <div id="inner-select-root">
              <div id="select-content">Select dropdown</div>
            </div>
          </div>
        </div>
      `
      const root = document.getElementById('root')!
      const selectRoot = document.getElementById('inner-select-root')!
      const selectContent = document.getElementById('select-content')!
      const controller = createPopover(root)

      controller.open()
      expect(controller.isOpen).toBe(true)

      // Simulate portaling the select content to body (like select component does)
      const portalState: PortalState = { originalParent: null, originalNextSibling: null, portaled: false }
      portalToBody(selectContent, selectRoot, portalState)

      // Click on the portaled select content — should NOT close the popover
      selectContent.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      )
      expect(controller.isOpen).toBe(true)

      restorePortal(selectContent, portalState)
      controller.destroy()
    })

    it('still closes popover when clicking truly outside', () => {
      document.body.innerHTML = `
        <div data-slot="popover" id="root">
          <button data-slot="popover-trigger">Open</button>
          <div data-slot="popover-content">Content</div>
        </div>
        <div id="outside">Outside</div>
      `
      const root = document.getElementById('root')!
      const outside = document.getElementById('outside')!
      const controller = createPopover(root)

      controller.open()
      expect(controller.isOpen).toBe(true)

      outside.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      )
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })
  })
})
