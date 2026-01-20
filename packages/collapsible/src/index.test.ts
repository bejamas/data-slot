import { describe, expect, it } from 'bun:test'
import { createCollapsible, create } from './index'

describe('Collapsible', () => {
  const setup = (defaultOpen = false) => {
    document.body.innerHTML = `
      <div data-slot="collapsible" id="root">
        <button data-slot="collapsible-trigger">Toggle</button>
        <div data-slot="collapsible-content">Content here</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="collapsible-content"]') as HTMLElement
    const controller = createCollapsible(root, { defaultOpen })

    return { root, trigger, content, controller }
  }

  it('initializes with content hidden by default', () => {
    const { content, controller } = setup()
    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)
    controller.destroy()
  })

  it('initializes with content visible when defaultOpen', () => {
    const { content, controller } = setup(true)
    expect(content.hidden).toBe(false)
    expect(controller.isOpen).toBe(true)
    controller.destroy()
  })

  it('opens and closes on trigger click', () => {
    const { trigger, content, controller } = setup()

    trigger.click()
    expect(content.hidden).toBe(false)
    expect(controller.isOpen).toBe(true)

    trigger.click()
    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)

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

  it('sets aria-controls linking trigger to content', () => {
    const { trigger, content, controller } = setup()

    expect(trigger.getAttribute('aria-controls')).toBe(content.id)
    controller.destroy()
  })

  it('sets data-state on root', () => {
    const { root, controller } = setup()

    expect(root.getAttribute('data-state')).toBe('closed')
    controller.open()
    expect(root.getAttribute('data-state')).toBe('open')
    controller.destroy()
  })

  it('sets data-state on content', () => {
    const { content, controller } = setup()

    expect(content.getAttribute('data-state')).toBe('closed')
    controller.open()
    expect(content.getAttribute('data-state')).toBe('open')
    controller.close()
    expect(content.getAttribute('data-state')).toBe('closed')
    controller.destroy()
  })

  it('sets role="region" and aria-labelledby on content', () => {
    const { trigger, content, controller } = setup()

    expect(content.getAttribute('role')).toBe('region')
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id)
    controller.destroy()
  })

  it('emits collapsible:change event', () => {
    const { root, controller } = setup()

    let lastOpen: boolean | undefined
    root.addEventListener('collapsible:change', (e) => {
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
      <div data-slot="collapsible" id="root">
        <button data-slot="collapsible-trigger">Toggle</button>
        <div data-slot="collapsible-content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    let lastOpen: boolean | undefined

    const controller = createCollapsible(root, {
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

  it('ignores click on disabled trigger (disabled attribute)', () => {
    document.body.innerHTML = `
      <div data-slot="collapsible" id="root">
        <button data-slot="collapsible-trigger" disabled>Toggle</button>
        <div data-slot="collapsible-content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="collapsible-content"]') as HTMLElement
    const controller = createCollapsible(root)

    trigger.click()
    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('ignores click on disabled trigger (aria-disabled)', () => {
    document.body.innerHTML = `
      <div data-slot="collapsible" id="root">
        <button data-slot="collapsible-trigger" aria-disabled="true">Toggle</button>
        <div data-slot="collapsible-content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="collapsible-content"]') as HTMLElement
    const controller = createCollapsible(root)

    trigger.click()
    expect(content.hidden).toBe(true)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('allows re-initialization after destroy', () => {
    document.body.innerHTML = `
      <div data-slot="collapsible">
        <button data-slot="collapsible-trigger">Toggle</button>
        <div data-slot="collapsible-content">Content</div>
      </div>
    `

    // First initialization via create()
    const controllers1 = create()
    expect(controllers1).toHaveLength(1)
    controllers1[0]?.destroy()

    // Re-initialize after destroy - should work
    const controllers2 = create()
    expect(controllers2).toHaveLength(1)
    controllers2[0]?.destroy()
  })

  it('create binds all collapsible components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="collapsible">
        <button data-slot="collapsible-trigger">One</button>
        <div data-slot="collapsible-content">Content One</div>
      </div>
      <div data-slot="collapsible">
        <button data-slot="collapsible-trigger">Two</button>
        <div data-slot="collapsible-content">Content Two</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(2)
    
    const triggers = document.querySelectorAll('[data-slot="collapsible-trigger"]')
    const contents = document.querySelectorAll('[data-slot="collapsible-content"]')

    // All should be hidden initially
    expect((contents[0] as HTMLElement).hidden).toBe(true)
    expect((contents[1] as HTMLElement).hidden).toBe(true)

    // Click first trigger
    ;(triggers[0] as HTMLElement).click()
    expect((contents[0] as HTMLElement).hidden).toBe(false)
    expect((contents[1] as HTMLElement).hidden).toBe(true)

    // Can control programmatically
    controllers[1]?.open()
    expect((contents[1] as HTMLElement).hidden).toBe(false)

    controllers.forEach(c => c.destroy())
  })

  it('throws error when missing required slots', () => {
    document.body.innerHTML = `
      <div data-slot="collapsible" id="root">
        <button data-slot="collapsible-trigger">Toggle</button>
      </div>
    `
    const root = document.getElementById('root')!

    expect(() => createCollapsible(root)).toThrow()
  })
})
