import { describe, expect, it } from 'bun:test'
import { createTabs, create } from './index'

describe('Tabs', () => {
  const setup = (defaultValue?: string) => {
    document.body.innerHTML = `
      <div data-slot="tabs" id="root">
        <div data-slot="tabs-list">
          <button data-slot="tabs-trigger" data-value="one">Tab One</button>
          <button data-slot="tabs-trigger" data-value="two">Tab Two</button>
          <button data-slot="tabs-trigger" data-value="three">Tab Three</button>
        </div>
        <div data-slot="tabs-content" data-value="one">Content One</div>
        <div data-slot="tabs-content" data-value="two">Content Two</div>
        <div data-slot="tabs-content" data-value="three">Content Three</div>
      </div>
    `
    const root = document.getElementById('root')!
    const list = document.querySelector('[data-slot="tabs-list"]') as HTMLElement
    const triggers = [...document.querySelectorAll('[data-slot="tabs-trigger"]')] as HTMLElement[]
    const panels = [...document.querySelectorAll('[data-slot="tabs-content"]')] as HTMLElement[]
    const controller = createTabs(root, { defaultValue })

    return { root, list, triggers, panels, controller }
  }

  it('initializes with first tab selected by default', () => {
    const { triggers, panels, controller } = setup()

    expect(controller.value).toBe('one')
    expect(triggers[0]?.getAttribute('aria-selected')).toBe('true')
    expect(triggers[1]?.getAttribute('aria-selected')).toBe('false')
    expect(panels[0]?.hidden).toBe(false)
    expect(panels[1]?.hidden).toBe(true)

    controller.destroy()
  })

  it('initializes with specified defaultValue', () => {
    const { triggers, panels, controller } = setup('two')

    expect(controller.value).toBe('two')
    expect(triggers[0]?.getAttribute('aria-selected')).toBe('false')
    expect(triggers[1]?.getAttribute('aria-selected')).toBe('true')
    expect(panels[0]?.hidden).toBe(true)
    expect(panels[1]?.hidden).toBe(false)

    controller.destroy()
  })

  it('reads defaultValue from data-default-value attribute', () => {
    document.body.innerHTML = `
      <div data-slot="tabs" id="root" data-default-value="two">
        <div data-slot="tabs-list">
          <button data-slot="tabs-trigger" data-value="one">Tab One</button>
          <button data-slot="tabs-trigger" data-value="two">Tab Two</button>
        </div>
        <div data-slot="tabs-content" data-value="one">Content One</div>
        <div data-slot="tabs-content" data-value="two">Content Two</div>
      </div>
    `
    const root = document.getElementById('root')!
    const controller = createTabs(root)

    expect(controller.value).toBe('two')
    
    const panels = document.querySelectorAll('[data-slot="tabs-content"]')
    expect((panels[0] as HTMLElement).hidden).toBe(true)
    expect((panels[1] as HTMLElement).hidden).toBe(false)

    controller.destroy()
  })

  it('selects tab on trigger click', () => {
    const { triggers, panels, controller } = setup()

    triggers[1]?.click()
    expect(controller.value).toBe('two')
    expect(panels[0]?.hidden).toBe(true)
    expect(panels[1]?.hidden).toBe(false)

    controller.destroy()
  })

  it('sets correct ARIA roles', () => {
    const { list, triggers, panels, controller } = setup()

    expect(list.getAttribute('role')).toBe('tablist')
    expect(triggers[0]?.getAttribute('role')).toBe('tab')
    expect(panels[0]?.getAttribute('role')).toBe('tabpanel')

    controller.destroy()
  })

  it('links tabs to panels via aria-controls', () => {
    const { triggers, panels, controller } = setup()

    const panelId = panels[0]?.id
    expect(triggers[0]?.getAttribute('aria-controls')).toBe(panelId)
    expect(panels[0]?.getAttribute('aria-labelledby')).toBe(triggers[0]?.id)

    controller.destroy()
  })

  it('sets tabindex correctly for roving focus', () => {
    const { triggers, controller } = setup()

    expect(triggers[0]?.tabIndex).toBe(0)
    expect(triggers[1]?.tabIndex).toBe(-1)
    expect(triggers[2]?.tabIndex).toBe(-1)

    controller.select('two')
    expect(triggers[0]?.tabIndex).toBe(-1)
    expect(triggers[1]?.tabIndex).toBe(0)

    controller.destroy()
  })

  it('navigates with arrow keys', () => {
    const { triggers, controller } = setup()

    triggers[0]?.focus()

    // Arrow right - dispatch from the focused trigger so event.target is correct
    triggers[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )
    expect(controller.value).toBe('two')

    // Arrow right again - now trigger[1] should be focused
    triggers[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )
    expect(controller.value).toBe('three')

    // Arrow right wraps to first
    triggers[2]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )
    expect(controller.value).toBe('one')

    // Arrow left wraps to last
    triggers[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    )
    expect(controller.value).toBe('three')

    controller.destroy()
  })

  it('navigates with Home and End keys', () => {
    const { triggers, controller } = setup('two')

    triggers[1]?.focus()

    triggers[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
    )
    expect(controller.value).toBe('one')

    triggers[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true })
    )
    expect(controller.value).toBe('three')

    controller.destroy()
  })

  it('sets data-state on triggers and panels', () => {
    const { triggers, panels, controller } = setup()

    expect(triggers[0]?.getAttribute('data-state')).toBe('active')
    expect(triggers[1]?.getAttribute('data-state')).toBe('inactive')
    expect(panels[0]?.getAttribute('data-state')).toBe('active')
    expect(panels[1]?.getAttribute('data-state')).toBe('inactive')

    controller.select('two')
    expect(triggers[0]?.getAttribute('data-state')).toBe('inactive')
    expect(triggers[1]?.getAttribute('data-state')).toBe('active')

    controller.destroy()
  })

  it('emits tabs:change event', () => {
    const { root, controller } = setup()

    let lastValue: string | undefined
    root.addEventListener('tabs:change', (e) => {
      lastValue = (e as CustomEvent).detail.value
    })

    controller.select('two')
    expect(lastValue).toBe('two')

    controller.destroy()
  })

  it('calls onValueChange callback', () => {
    document.body.innerHTML = `
      <div data-slot="tabs" id="root">
        <div data-slot="tabs-list">
          <button data-slot="tabs-trigger" data-value="a">A</button>
          <button data-slot="tabs-trigger" data-value="b">B</button>
        </div>
        <div data-slot="tabs-content" data-value="a">A</div>
        <div data-slot="tabs-content" data-value="b">B</div>
      </div>
    `
    const root = document.getElementById('root')!
    let lastValue: string | undefined

    const controller = createTabs(root, {
      onValueChange: (value) => {
        lastValue = value
      },
    })

    controller.select('b')
    expect(lastValue).toBe('b')

    controller.destroy()
  })

  it('create binds all tabs components and returns controllers', () => {
    document.body.innerHTML = `
      <div data-slot="tabs">
        <div data-slot="tabs-list">
          <button data-slot="tabs-trigger" data-value="x">X</button>
          <button data-slot="tabs-trigger" data-value="y">Y</button>
        </div>
        <div data-slot="tabs-content" data-value="x">X Content</div>
        <div data-slot="tabs-content" data-value="y">Y Content</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(1)
    
    const triggers = document.querySelectorAll('[data-slot="tabs-trigger"]')
    const panels = document.querySelectorAll('[data-slot="tabs-content"]')

    expect((panels[0] as HTMLElement).hidden).toBe(false)
    expect((panels[1] as HTMLElement).hidden).toBe(true)

    ;(triggers[1] as HTMLElement).click()
    expect((panels[0] as HTMLElement).hidden).toBe(true)
    expect((panels[1] as HTMLElement).hidden).toBe(false)

    // Can control programmatically
    controllers[0]?.select('x')
    expect((panels[0] as HTMLElement).hidden).toBe(false)

    controllers.forEach(c => c.destroy())
  })

  // Data attribute tests
  describe('data attributes', () => {
    it("data-orientation='vertical' sets vertical orientation", () => {
      document.body.innerHTML = `
        <div data-slot="tabs" id="root" data-orientation="vertical">
          <div data-slot="tabs-list">
            <button data-slot="tabs-trigger" data-value="one">One</button>
            <button data-slot="tabs-trigger" data-value="two">Two</button>
          </div>
          <div data-slot="tabs-content" data-value="one">Content One</div>
          <div data-slot="tabs-content" data-value="two">Content Two</div>
        </div>
      `
      const root = document.getElementById('root')!
      const list = root.querySelector('[data-slot="tabs-list"]') as HTMLElement
      const controller = createTabs(root)

      expect(list.getAttribute('aria-orientation')).toBe('vertical')

      controller.destroy()
    })

    it("data-activation-mode='manual' requires Enter to activate", () => {
      document.body.innerHTML = `
        <div data-slot="tabs" id="root" data-activation-mode="manual">
          <div data-slot="tabs-list">
            <button data-slot="tabs-trigger" data-value="one">One</button>
            <button data-slot="tabs-trigger" data-value="two">Two</button>
          </div>
          <div data-slot="tabs-content" data-value="one">Content One</div>
          <div data-slot="tabs-content" data-value="two">Content Two</div>
        </div>
      `
      const root = document.getElementById('root')!
      const triggers = root.querySelectorAll('[data-slot="tabs-trigger"]')
      const controller = createTabs(root)

      // Focus first trigger and press ArrowRight
      ;(triggers[0] as HTMLElement).focus()
      triggers[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

      // In manual mode, ArrowRight just moves focus, doesn't change value
      expect(controller.value).toBe('one')
      expect(document.activeElement).toBe(triggers[1])

      // Press Enter to activate
      triggers[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(controller.value).toBe('two')

      controller.destroy()
    })

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="tabs" id="root" data-orientation="vertical">
          <div data-slot="tabs-list">
            <button data-slot="tabs-trigger" data-value="one">One</button>
            <button data-slot="tabs-trigger" data-value="two">Two</button>
          </div>
          <div data-slot="tabs-content" data-value="one">Content One</div>
          <div data-slot="tabs-content" data-value="two">Content Two</div>
        </div>
      `
      const root = document.getElementById('root')!
      const list = root.querySelector('[data-slot="tabs-list"]') as HTMLElement
      // JS option says horizontal, data attribute says vertical - JS wins
      const controller = createTabs(root, { orientation: 'horizontal' })

      expect(list.hasAttribute('aria-orientation')).toBe(false)

      controller.destroy()
    })
  })
})

