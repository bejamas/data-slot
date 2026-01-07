import { describe, expect, it } from 'bun:test'
import { createAccordion, create } from './index'

describe('Accordion', () => {
  const setup = (options: Parameters<typeof createAccordion>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="accordion" id="root">
        <div data-slot="accordion-item" data-value="one">
          <button data-slot="accordion-trigger">Item One</button>
          <div data-slot="accordion-content">Content One</div>
        </div>
        <div data-slot="accordion-item" data-value="two">
          <button data-slot="accordion-trigger">Item Two</button>
          <div data-slot="accordion-content">Content Two</div>
        </div>
        <div data-slot="accordion-item" data-value="three">
          <button data-slot="accordion-trigger">Item Three</button>
          <div data-slot="accordion-content">Content Three</div>
        </div>
      </div>
    `
    const root = document.getElementById('root')!
    const items = [...document.querySelectorAll('[data-slot="accordion-item"]')] as HTMLElement[]
    const triggers = [...document.querySelectorAll('[data-slot="accordion-trigger"]')] as HTMLElement[]
    const contents = [...document.querySelectorAll('[data-slot="accordion-content"]')] as HTMLElement[]
    const controller = createAccordion(root, options)

    return { root, items, triggers, contents, controller }
  }

  it('initializes with all items collapsed by default', () => {
    const { contents, controller } = setup()

    expect(contents[0]?.hidden).toBe(true)
    expect(contents[1]?.hidden).toBe(true)
    expect(contents[2]?.hidden).toBe(true)
    expect(controller.value).toEqual([])

    controller.destroy()
  })

  it('initializes with defaultValue expanded', () => {
    const { contents, controller } = setup({ defaultValue: 'two' })

    expect(contents[0]?.hidden).toBe(true)
    expect(contents[1]?.hidden).toBe(false)
    expect(contents[2]?.hidden).toBe(true)
    expect(controller.value).toEqual(['two'])

    controller.destroy()
  })

  it('expands item on trigger click', () => {
    const { triggers, contents, controller } = setup()

    triggers[0]?.click()
    expect(contents[0]?.hidden).toBe(false)
    expect(controller.value).toEqual(['one'])

    controller.destroy()
  })

  it('collapses other items in single mode', () => {
    const { triggers, contents, controller } = setup({ defaultValue: 'one' })

    triggers[1]?.click()
    expect(contents[0]?.hidden).toBe(true)
    expect(contents[1]?.hidden).toBe(false)
    expect(controller.value).toEqual(['two'])

    controller.destroy()
  })

  it('allows multiple items in multiple mode', () => {
    const { triggers, contents, controller } = setup({ multiple: true })

    triggers[0]?.click()
    triggers[1]?.click()
    expect(contents[0]?.hidden).toBe(false)
    expect(contents[1]?.hidden).toBe(false)
    expect(controller.value).toEqual(['one', 'two'])

    controller.destroy()
  })

  it('toggles items on click', () => {
    const { triggers, contents, controller } = setup({ collapsible: true })

    triggers[0]?.click()
    expect(contents[0]?.hidden).toBe(false)

    triggers[0]?.click()
    expect(contents[0]?.hidden).toBe(true)

    controller.destroy()
  })

  it('respects collapsible option in single mode', () => {
    const { triggers, contents, controller } = setup({
      defaultValue: 'one',
      collapsible: false,
    })

    // Cannot collapse the only open item
    triggers[0]?.click()
    expect(contents[0]?.hidden).toBe(false)
    expect(controller.value).toEqual(['one'])

    controller.destroy()
  })

  it('sets aria-expanded on triggers', () => {
    const { triggers, controller } = setup()

    expect(triggers[0]?.getAttribute('aria-expanded')).toBe('false')

    controller.expand('one')
    expect(triggers[0]?.getAttribute('aria-expanded')).toBe('true')

    controller.collapse('one')
    expect(triggers[0]?.getAttribute('aria-expanded')).toBe('false')

    controller.destroy()
  })

  it('sets data-state on items', () => {
    const { items, controller } = setup()

    expect(items[0]?.getAttribute('data-state')).toBe('closed')

    controller.expand('one')
    expect(items[0]?.getAttribute('data-state')).toBe('open')

    controller.destroy()
  })

  it('emits accordion:change event', () => {
    const { root, controller } = setup()

    let lastValue: string[] = []
    root.addEventListener('accordion:change', (e) => {
      lastValue = (e as CustomEvent).detail.value
    })

    controller.expand('one')
    expect(lastValue).toEqual(['one'])

    controller.collapse('one')
    expect(lastValue).toEqual([])

    controller.destroy()
  })

  it('controller methods work correctly', () => {
    const { controller } = setup({ multiple: true })

    controller.expand('one')
    expect(controller.value).toEqual(['one'])

    controller.expand('two')
    expect(controller.value).toEqual(['one', 'two'])

    controller.collapse('one')
    expect(controller.value).toEqual(['two'])

    controller.toggle('two')
    expect(controller.value).toEqual([])

    controller.toggle('three')
    expect(controller.value).toEqual(['three'])

    controller.destroy()
  })

  it('create binds all accordion components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="accordion">
        <div data-slot="accordion-item" data-value="a">
          <button data-slot="accordion-trigger">A</button>
          <div data-slot="accordion-content">A Content</div>
        </div>
        <div data-slot="accordion-item" data-value="b">
          <button data-slot="accordion-trigger">B</button>
          <div data-slot="accordion-content">B Content</div>
        </div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(1)
    
    const triggers = document.querySelectorAll('[data-slot="accordion-trigger"]')
    const contents = document.querySelectorAll('[data-slot="accordion-content"]')

    expect((contents[0] as HTMLElement).hidden).toBe(true)
    ;(triggers[0] as HTMLElement).click()
    expect((contents[0] as HTMLElement).hidden).toBe(false)

    // Can control programmatically
    controllers[0]?.expand('b')
    expect((contents[1] as HTMLElement).hidden).toBe(false)

    controllers.forEach(c => c.destroy())
  })

  // Keyboard navigation tests
  it('ArrowDown moves focus to next trigger', () => {
    const { triggers, controller } = setup()

    triggers[0]?.focus()
    expect(document.activeElement).toBe(triggers[0])

    triggers[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    )
    expect(document.activeElement).toBe(triggers[1])

    controller.destroy()
  })

  it('ArrowUp moves focus to previous trigger', () => {
    const { triggers, controller } = setup()

    triggers[1]?.focus()
    expect(document.activeElement).toBe(triggers[1])

    triggers[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    )
    expect(document.activeElement).toBe(triggers[0])

    controller.destroy()
  })

  it('ArrowDown wraps from last to first trigger', () => {
    const { triggers, controller } = setup()

    triggers[2]?.focus()
    expect(document.activeElement).toBe(triggers[2])

    triggers[2]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    )
    expect(document.activeElement).toBe(triggers[0])

    controller.destroy()
  })

  it('ArrowUp wraps from first to last trigger', () => {
    const { triggers, controller } = setup()

    triggers[0]?.focus()
    expect(document.activeElement).toBe(triggers[0])

    triggers[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    )
    expect(document.activeElement).toBe(triggers[2])

    controller.destroy()
  })

  it('Home key focuses first trigger', () => {
    const { triggers, controller } = setup()

    triggers[2]?.focus()
    expect(document.activeElement).toBe(triggers[2])

    triggers[2]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
    )
    expect(document.activeElement).toBe(triggers[0])

    controller.destroy()
  })

  it('End key focuses last trigger', () => {
    const { triggers, controller } = setup()

    triggers[0]?.focus()
    expect(document.activeElement).toBe(triggers[0])

    triggers[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true })
    )
    expect(document.activeElement).toBe(triggers[2])

    controller.destroy()
  })
})

