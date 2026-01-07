import { describe, expect, it } from 'bun:test'
import { createPopover, create } from './index'

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

  it('sets data-state on root', () => {
    const { root, controller } = setup()

    expect(root.getAttribute('data-state')).toBe('closed')

    controller.open()
    expect(root.getAttribute('data-state')).toBe('open')

    controller.close()
    expect(root.getAttribute('data-state')).toBe('closed')

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
})

