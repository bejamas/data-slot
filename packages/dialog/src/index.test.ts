import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { createDialog, create } from './index'

describe('Dialog', () => {
  const setup = (options: Parameters<typeof createDialog>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open Dialog</button>
        <div data-slot="dialog-content">
          <h2 data-slot="dialog-title">Dialog Title</h2>
          <p data-slot="dialog-description">Dialog description text.</p>
          <button data-slot="dialog-close">Close</button>
          <input type="text" placeholder="Focus me" />
        </div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="dialog-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="dialog-content"]') as HTMLElement
    const closeBtn = document.querySelector('[data-slot="dialog-close"]') as HTMLElement
    const title = document.querySelector('[data-slot="dialog-title"]') as HTMLElement
    const description = document.querySelector('[data-slot="dialog-description"]') as HTMLElement
    const input = document.querySelector('input') as HTMLInputElement
    const controller = createDialog(root, options)

    return { root, trigger, content, closeBtn, title, description, input, controller }
  }

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

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

  it('closes on Escape key', () => {
    const { controller } = setup()

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('respects closeOnEscape option', () => {
    const { controller } = setup({ closeOnEscape: false })

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('closes on click outside content', () => {
    const { controller } = setup()

    controller.open()
    expect(controller.isOpen).toBe(true)

    // Click outside
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('respects closeOnClickOutside option', () => {
    const { controller } = setup({ closeOnClickOutside: false })

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('sets correct ARIA attributes', () => {
    const { trigger, content, title, description, controller } = setup()

    expect(content.getAttribute('role')).toBe('dialog')
    expect(content.getAttribute('aria-modal')).toBe('true')
    expect(content.getAttribute('aria-labelledby')).toBe(title.id)
    expect(content.getAttribute('aria-describedby')).toBe(description.id)
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-controls')).toBe(content.id)

    controller.destroy()
  })

  it('sets aria-expanded on trigger', () => {
    const { trigger, controller } = setup()

    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    controller.open()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    controller.close()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

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

  it('locks scroll when open', () => {
    const { controller } = setup({ lockScroll: true })

    controller.open()
    expect(document.body.style.overflow).toBe('hidden')

    controller.close()
    expect(document.body.style.overflow).toBe('')

    controller.destroy()
  })

  it('respects lockScroll option', () => {
    const { controller } = setup({ lockScroll: false })

    controller.open()
    expect(document.body.style.overflow).toBe('')

    controller.destroy()
  })

  it('emits dialog:change event', () => {
    const { root, controller } = setup()

    let lastOpen: boolean | undefined
    root.addEventListener('dialog:change', (e) => {
      lastOpen = (e as CustomEvent).detail.open
    })

    controller.open()
    expect(lastOpen).toBe(true)

    controller.close()
    expect(lastOpen).toBe(false)

    controller.destroy()
  })

  it('calls onOpenChange callback', () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    let lastOpen: boolean | undefined

    const controller = createDialog(root, {
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

  it('toggle method works correctly', () => {
    const { controller } = setup()

    expect(controller.isOpen).toBe(false)
    controller.toggle()
    expect(controller.isOpen).toBe(true)
    controller.toggle()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('works without a trigger', () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-content">
          <button data-slot="dialog-close">Close</button>
        </div>
      </div>
    `
    const root = document.getElementById('root')!
    const controller = createDialog(root)

    expect(controller.isOpen).toBe(false)
    controller.open()
    expect(controller.isOpen).toBe(true)

    const closeBtn = document.querySelector('[data-slot="dialog-close"]') as HTMLElement
    closeBtn.click()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('create binds all dialog components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="dialog">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-content">Content</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(1)
    
    const trigger = document.querySelector('[data-slot="dialog-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="dialog-content"]') as HTMLElement

    expect(content.hidden).toBe(true)
    trigger.click()
    expect(content.hidden).toBe(false)

    // Can control programmatically
    controllers[0]?.close()
    expect(content.hidden).toBe(true)

    controllers.forEach(c => c.destroy())
  })

  it('throws error when missing content slot', () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open</button>
      </div>
    `
    const root = document.getElementById('root')!

    expect(() => createDialog(root)).toThrow()
  })
})

