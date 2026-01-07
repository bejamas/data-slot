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

  it('initializes with content hidden', () => {
    const { content, controller } = setup()

    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('shows immediately via controller.show()', () => {
    const { content, controller } = setup()

    controller.show()
    expect(content.hidden).toBe(false)
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('hides via controller.hide()', () => {
    const { content, controller } = setup()

    controller.show()
    expect(content.hidden).toBe(false)

    controller.hide()
    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('sets ARIA attributes correctly', () => {
    const { trigger, content, controller } = setup()

    expect(trigger.getAttribute('aria-describedby')).toBe(content.id)
    expect(content.getAttribute('role')).toBe('tooltip')

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

  it('hides on Escape key', () => {
    const { controller } = setup()

    controller.show()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('emits tooltip:change event', () => {
    const { root, controller } = setup()

    let lastOpen: boolean | undefined
    root.addEventListener('tooltip:change', (e) => {
      lastOpen = (e as CustomEvent).detail.open
    })

    controller.show()
    expect(lastOpen).toBe(true)

    controller.hide()
    expect(lastOpen).toBe(false)

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

  it('hides on mouseleave', () => {
    const { trigger, controller } = setup({ delay: 0 })

    controller.show()
    expect(controller.isOpen).toBe(true)

    trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
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
    
    const content = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement

    expect(content.hidden).toBe(true)

    // Can control programmatically
    controllers[0]?.show()
    expect(content.hidden).toBe(false)

    controllers.forEach(c => c.destroy())
  })
})

