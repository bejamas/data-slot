import { describe, expect, it } from 'bun:test'
import { createDisclosure, create } from './index'

describe('Disclosure', () => {
  const setup = (defaultOpen = false) => {
    document.body.innerHTML = `
      <div data-slot="disclosure" id="root">
        <button data-slot="disclosure-trigger">Toggle</button>
        <div data-slot="disclosure-content">Content here</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = document.querySelector('[data-slot="disclosure-trigger"]') as HTMLElement
    const content = document.querySelector('[data-slot="disclosure-content"]') as HTMLElement
    const controller = createDisclosure(root, { defaultOpen })

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

  it('emits disclosure:change event', () => {
    const { root, controller } = setup()

    let lastOpen: boolean | undefined
    root.addEventListener('disclosure:change', (e) => {
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
      <div data-slot="disclosure" id="root">
        <button data-slot="disclosure-trigger">Toggle</button>
        <div data-slot="disclosure-content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    let lastOpen: boolean | undefined

    const controller = createDisclosure(root, {
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

  it('create binds all disclosure components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="disclosure">
        <button data-slot="disclosure-trigger">One</button>
        <div data-slot="disclosure-content">Content One</div>
      </div>
      <div data-slot="disclosure">
        <button data-slot="disclosure-trigger">Two</button>
        <div data-slot="disclosure-content">Content Two</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(2)
    
    const triggers = document.querySelectorAll('[data-slot="disclosure-trigger"]')
    const contents = document.querySelectorAll('[data-slot="disclosure-content"]')

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
      <div data-slot="disclosure" id="root">
        <button data-slot="disclosure-trigger">Toggle</button>
      </div>
    `
    const root = document.getElementById('root')!

    expect(() => createDisclosure(root)).toThrow()
  })
})

