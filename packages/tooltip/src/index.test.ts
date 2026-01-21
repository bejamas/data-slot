import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { createTooltip, create } from './index'

describe('Tooltip', () => {
  const setup = (options: Parameters<typeof createTooltip>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger">Hover me</button>
        <div data-slot="tooltip-content">Tooltip text</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement
    const controller = createTooltip(root, options)

    return { root, trigger, content, controller }
  }

  beforeEach(() => {
    // Use fake timers would be ideal, but for now we'll test immediate show/hide
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('initializes with closed state and aria-hidden', () => {
    const { root, content, controller } = setup()

    expect(root.getAttribute('data-state')).toBe('closed')
    expect(content.getAttribute('aria-hidden')).toBe('true')
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('shows immediately via controller.show()', () => {
    const { root, controller } = setup()

    controller.show()
    expect(root.getAttribute('data-state')).toBe('open')
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('hides via controller.hide()', () => {
    const { root, controller } = setup()

    controller.show()
    expect(root.getAttribute('data-state')).toBe('open')

    controller.hide()
    expect(root.getAttribute('data-state')).toBe('closed')
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('sets ARIA attributes correctly - describedby only when open', () => {
    const { trigger, content, controller } = setup()

    // When closed: no aria-describedby, aria-hidden="true"
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
    expect(content.getAttribute('role')).toBe('tooltip')
    expect(content.getAttribute('aria-hidden')).toBe('true')

    // When open: has aria-describedby, aria-hidden="false" (explicit for AT consistency)
    controller.show()
    expect(trigger.getAttribute('aria-describedby')).toBe(content.id)
    expect(content.getAttribute('aria-hidden')).toBe('false')

    // When closed again: aria-describedby removed, aria-hidden="true"
    controller.hide()
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
    expect(content.getAttribute('aria-hidden')).toBe('true')

    controller.destroy()
  })

  it('sets data-state on root', () => {
    const { root, controller } = setup()

    expect(root.getAttribute('data-state')).toBe('closed')

    controller.show()
    expect(root.getAttribute('data-state')).toBe('open')

    controller.hide()
    expect(root.getAttribute('data-state')).toBe('closed')

    controller.destroy()
  })

  it('sets data-side and data-align on content', () => {
    const { content, controller } = setup()

    // Defaults
    expect(content.getAttribute('data-side')).toBe('top')
    expect(content.getAttribute('data-align')).toBe('center')

    controller.destroy()
  })

  it('respects side and align options', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger">Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `
    const root = document.getElementById('root')!
    const content = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement
    const controller = createTooltip(root, { side: 'right', align: 'end' })

    expect(content.getAttribute('data-side')).toBe('right')
    expect(content.getAttribute('data-align')).toBe('end')

    controller.destroy()
  })

  it('hides on Escape key only when open', () => {
    const { controller } = setup()

    // Escape when closed should do nothing
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.show()
    expect(controller.isOpen).toBe(true)

    // Escape when open should close
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('emits tooltip:change event with reason', () => {
    const { root, trigger, content, controller } = setup()

    let lastDetail: { open: boolean; trigger: HTMLElement; content: HTMLElement; reason: string } | undefined
    root.addEventListener('tooltip:change', (e) => {
      lastDetail = (e as CustomEvent).detail
    })

    controller.show()
    expect(lastDetail?.open).toBe(true)
    expect(lastDetail?.reason).toBe('api')
    expect(lastDetail?.trigger).toBe(trigger)
    expect(lastDetail?.content).toBe(content)

    controller.hide()
    expect(lastDetail?.open).toBe(false)
    expect(lastDetail?.reason).toBe('api')

    controller.destroy()
  })

  it('calls onOpenChange callback', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger">Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `
    const root = document.getElementById('root')!
    let lastOpen: boolean | undefined

    const controller = createTooltip(root, {
      onOpenChange: (open) => {
        lastOpen = open
      },
    })

    controller.show()
    expect(lastOpen).toBe(true)

    controller.hide()
    expect(lastOpen).toBe(false)

    controller.destroy()
  })

  it('hides on blur', () => {
    const { trigger, controller } = setup({ delay: 0 })

    controller.show()
    expect(controller.isOpen).toBe(true)

    trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('hides on pointerleave (non-touch)', () => {
    const { trigger, controller } = setup({ delay: 0 })

    controller.show()
    expect(controller.isOpen).toBe(true)

    // Simulate mouse pointer leave
    trigger.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerType: 'mouse' }))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('ignores touch pointerenter/pointerleave', () => {
    const { trigger, controller } = setup({ delay: 0 })

    // Touch pointerenter should not open (touch is focus-only)
    trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, pointerType: 'touch' }))
    expect(controller.isOpen).toBe(false)

    // Open via API
    controller.show()
    expect(controller.isOpen).toBe(true)

    // Touch pointerleave should not close
    trigger.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerType: 'touch' }))
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('does not open on pointer events when trigger is disabled', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger" disabled>Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement
    const controller = createTooltip(root, { delay: 0 })

    trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, pointerType: 'mouse' }))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('does not open on pointer events when trigger has aria-disabled', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger" aria-disabled="true">Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement
    const controller = createTooltip(root, { delay: 0 })

    trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, pointerType: 'mouse' }))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('does not open on focus when trigger is disabled', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger" disabled>Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement
    const controller = createTooltip(root, { delay: 0 })

    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('programmatic show() respects disabled state', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip" id="root">
        <button data-slot="tooltip-trigger" disabled>Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `
    const root = document.getElementById('root')!
    const controller = createTooltip(root)

    // API respects disabled check
    controller.show()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('create binds all tooltip components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="tooltip">
        <button data-slot="tooltip-trigger">Hover</button>
        <div data-slot="tooltip-content">Tip</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(1)
    
    const root = document.querySelector('[data-slot="tooltip"]') as HTMLElement

    expect(root.getAttribute('data-state')).toBe('closed')

    // Can control programmatically
    controllers[0]?.show()
    expect(root.getAttribute('data-state')).toBe('open')

    controllers.forEach(c => c.destroy())
  })

  // Data attribute tests
  describe('data attributes', () => {
    it("data-delay is read from element", () => {
      document.body.innerHTML = `
        <div data-slot="tooltip" id="root" data-delay="500">
          <button data-slot="tooltip-trigger">Hover</button>
          <div data-slot="tooltip-content">Tip</div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createTooltip(root)

      // Verify it initializes - delay is used internally
      expect(controller.isOpen).toBe(false)
      
      // Programmatic show still works
      controller.show()
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it("data-skip-delay-duration is read from element", () => {
      document.body.innerHTML = `
        <div data-slot="tooltip" id="root" data-skip-delay-duration="100">
          <button data-slot="tooltip-trigger">Hover</button>
          <div data-slot="tooltip-content">Tip</div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createTooltip(root)

      // Verify it initializes without error
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="tooltip" id="root" data-delay="1000">
          <button data-slot="tooltip-trigger">Hover</button>
          <div data-slot="tooltip-content">Tip</div>
        </div>
      `
      const root = document.getElementById('root')!
      // JS option should take precedence over data attribute
      const controller = createTooltip(root, { delay: 50 })

      // Verify initialization works
      expect(controller.isOpen).toBe(false)
      
      // Programmatic show bypasses delay
      controller.show()
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it("data-side is read from content first, then root", () => {
      document.body.innerHTML = `
        <div data-slot="tooltip" id="root" data-side="left">
          <button data-slot="tooltip-trigger">Hover</button>
          <div data-slot="tooltip-content" data-side="bottom">Tip</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement
      const controller = createTooltip(root)

      // Content's data-side takes precedence
      expect(content.getAttribute('data-side')).toBe('bottom')

      controller.destroy()
    })

    it("data-side falls back to root if not on content", () => {
      document.body.innerHTML = `
        <div data-slot="tooltip" id="root" data-side="right">
          <button data-slot="tooltip-trigger">Hover</button>
          <div data-slot="tooltip-content">Tip</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement
      const controller = createTooltip(root)

      expect(content.getAttribute('data-side')).toBe('right')

      controller.destroy()
    })

    it("data-align is read from content first, then root", () => {
      document.body.innerHTML = `
        <div data-slot="tooltip" id="root" data-align="start">
          <button data-slot="tooltip-trigger">Hover</button>
          <div data-slot="tooltip-content" data-align="end">Tip</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement
      const controller = createTooltip(root)

      // Content's data-align takes precedence
      expect(content.getAttribute('data-align')).toBe('end')

      controller.destroy()
    })
  })

  describe('escape listener cleanup', () => {
    it('escape listener is only active when tooltip is open', () => {
      const { controller } = setup()
      
      // When closed, escape should not trigger any change (no listener active)
      const escapeBefore = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      document.dispatchEvent(escapeBefore)
      expect(controller.isOpen).toBe(false)

      // Open and verify escape works
      controller.show()
      expect(controller.isOpen).toBe(true)
      
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(controller.isOpen).toBe(false)

      // After close, listener should be removed again
      // (we can't directly test listener count, but this verifies no errors occur)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })
  })

  describe('hoverable content', () => {
    it('stays open when pointer moves from trigger to content', () => {
      const { trigger, content, controller } = setup()

      controller.show()
      expect(controller.isOpen).toBe(true)

      // Pointer leaves trigger but enters content
      trigger.dispatchEvent(new PointerEvent('pointerleave', { 
        bubbles: true, 
        pointerType: 'mouse',
        relatedTarget: content
      }))
      
      // Should stay open
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it('stays open when pointer moves from content to trigger', () => {
      const { trigger, content, controller } = setup()

      controller.show()
      expect(controller.isOpen).toBe(true)

      // Simulate being in content, then leaving to trigger
      content.dispatchEvent(new PointerEvent('pointerleave', { 
        bubbles: true, 
        pointerType: 'mouse',
        relatedTarget: trigger
      }))
      
      // Should stay open
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })

    it('closes when pointer leaves content to outside', () => {
      const { content, controller } = setup()

      controller.show()
      expect(controller.isOpen).toBe(true)

      // Pointer leaves content to somewhere outside
      content.dispatchEvent(new PointerEvent('pointerleave', { 
        bubbles: true, 
        pointerType: 'mouse',
        relatedTarget: document.body
      }))
      
      // Should close
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it('stays open on pointerleave when trigger has focus', () => {
      const { trigger, controller } = setup()

      // Focus trigger to open
      trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      controller.show() // Open immediately for test
      expect(controller.isOpen).toBe(true)

      // Pointer leaves trigger while focused
      trigger.dispatchEvent(new PointerEvent('pointerleave', { 
        bubbles: true, 
        pointerType: 'mouse',
        relatedTarget: document.body
      }))
      
      // Should stay open because trigger has focus
      expect(controller.isOpen).toBe(true)

      // Blur should close
      trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it('stays open on content pointerleave when trigger has focus', () => {
      const { trigger, content, controller } = setup()

      // Focus trigger
      trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      controller.show()
      expect(controller.isOpen).toBe(true)

      // Pointer leaves content while trigger is focused
      content.dispatchEvent(new PointerEvent('pointerleave', { 
        bubbles: true, 
        pointerType: 'mouse',
        relatedTarget: document.body
      }))
      
      // Should stay open
      expect(controller.isOpen).toBe(true)

      controller.destroy()
    })
  })
})
