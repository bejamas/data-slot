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

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

  const waitForExit = async () => {
    await waitForRaf()
    await waitForRaf()
  }

  const mockScrollSize = (element: HTMLElement, initialHeight: number, initialWidth: number) => {
    let height = initialHeight
    let width = initialWidth

    Object.defineProperty(element, 'scrollHeight', {
      configurable: true,
      get: () => height,
    })

    Object.defineProperty(element, 'scrollWidth', {
      configurable: true,
      get: () => width,
    })

    return (nextHeight: number, nextWidth: number) => {
      height = nextHeight
      width = nextWidth
    }
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

  it('initializes with hidden="until-found" when hiddenUntilFound is enabled', () => {
    const { content, controller } = setup()
    controller.destroy()

    const root = document.getElementById('root')!
    const controller2 = createCollapsible(root, { hiddenUntilFound: true })

    expect(controller2.isOpen).toBe(false)
    expect(content.getAttribute('hidden')).toBe('until-found')

    controller2.destroy()
  })

  it('initializes panel size variables to 0px when closed', () => {
    const { content, controller } = setup()

    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('0px')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('0px')

    controller.destroy()
  })

  it('measures panel size variables when initially open', () => {
    document.body.innerHTML = `
      <div data-slot="collapsible" id="root">
        <button data-slot="collapsible-trigger">Toggle</button>
        <div data-slot="collapsible-content">Content here</div>
      </div>
    `

    const root = document.getElementById('root')!
    const content = root.querySelector('[data-slot="collapsible-content"]') as HTMLElement
    mockScrollSize(content, 120, 240)

    const controller = createCollapsible(root, { defaultOpen: true })

    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('120px')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('240px')

    controller.destroy()
  })

  it('switches panel size variables to auto after open settles', async () => {
    const { content, controller } = setup()
    mockScrollSize(content, 100, 200)

    controller.open()
    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('100px')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('200px')

    await waitForRaf()

    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('auto')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('auto')

    controller.destroy()
  })

  it('freezes to px and then transitions panel size vars to 0px on close', async () => {
    const { content, controller } = setup()
    const setSize = mockScrollSize(content, 80, 160)

    controller.open()
    await waitForRaf()

    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('auto')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('auto')

    setSize(96, 180)
    controller.close()

    // First frame of close: freeze from auto to measured px.
    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('96px')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('180px')

    await waitForRaf()

    // Closing phase drives vars down to zero for smooth collapse.
    expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('0px')
    expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('0px')

    controller.destroy()
  })

  it('does not override auto panel vars when ResizeObserver fires while open', async () => {
    const OriginalResizeObserver = globalThis.ResizeObserver
    let resizeCallback: ResizeObserverCallback | null = null

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    }

    ;(globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver

    try {
      document.body.innerHTML = `
        <div data-slot="collapsible" id="root">
          <button data-slot="collapsible-trigger">Toggle</button>
          <div data-slot="collapsible-content">Content here</div>
        </div>
      `

      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="collapsible-content"]') as HTMLElement
      const setSize = mockScrollSize(content, 100, 200)

      const controller = createCollapsible(root, { defaultOpen: true })

      await waitForRaf()
      expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('auto')
      expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('auto')

      setSize(140, 260)
      if (resizeCallback) {
        resizeCallback([], {} as ResizeObserver)
      }

      // At rest we keep auto, and let layout size itself naturally.
      expect(content.style.getPropertyValue('--collapsible-panel-height')).toBe('auto')
      expect(content.style.getPropertyValue('--collapsible-panel-width')).toBe('auto')

      controller.destroy()
    } finally {
      if (OriginalResizeObserver) {
        ;(globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
          OriginalResizeObserver
      } else {
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
      }
    }
  })

  it('opens and closes on trigger click', async () => {
    const { trigger, content, controller } = setup()

    trigger.click()
    expect(content.hidden).toBe(false)
    expect(controller.isOpen).toBe(true)

    trigger.click()
    expect(controller.isOpen).toBe(false)
    await waitForExit()
    expect(content.hidden).toBe(true)

    controller.destroy()
  })

  it('sets data-starting-style on open and clears it after bootstrap frames', async () => {
    const { content, controller } = setup()

    controller.open()
    expect(content.hasAttribute('data-starting-style')).toBe(true)

    await waitForRaf()
    expect(content.hasAttribute('data-starting-style')).toBe(true)

    await waitForRaf()
    expect(content.hasAttribute('data-starting-style')).toBe(false)

    controller.destroy()
  })

  it('sets data-ending-style on close and hides after exit completes', async () => {
    const { content, controller } = setup(true)

    controller.close()
    expect(content.hasAttribute('data-ending-style')).toBe(true)
    expect(content.hidden).toBe(false)

    await waitForExit()
    expect(content.hasAttribute('data-ending-style')).toBe(false)
    expect(content.hidden).toBe(true)

    controller.destroy()
  })

  it('opens on beforematch when hiddenUntilFound is enabled', () => {
    const { root, content, controller } = setup()
    controller.destroy()

    const controller2 = createCollapsible(root, { hiddenUntilFound: true })
    expect(controller2.isOpen).toBe(false)
    expect(content.getAttribute('hidden')).toBe('until-found')

    content.dispatchEvent(new Event('beforematch', { bubbles: true }))

    expect(controller2.isOpen).toBe(true)
    expect(content.hasAttribute('hidden')).toBe(false)

    controller2.destroy()
  })

  it('applies hidden="until-found" again after closing', async () => {
    const { root, content, controller } = setup()
    controller.destroy()

    const controller2 = createCollapsible(root, { hiddenUntilFound: true })

    controller2.open()
    expect(content.hasAttribute('hidden')).toBe(false)

    controller2.close()
    await waitForExit()
    expect(content.getAttribute('hidden')).toBe('until-found')

    controller2.destroy()
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

  // Data attribute tests
  describe('data attributes', () => {
    it("data-default-open opens collapsible initially", () => {
      document.body.innerHTML = `
        <div data-slot="collapsible" id="root" data-default-open>
          <button data-slot="collapsible-trigger">Toggle</button>
          <div data-slot="collapsible-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="collapsible-content"]') as HTMLElement
      const controller = createCollapsible(root)

      expect(controller.isOpen).toBe(true)
      expect(content.hidden).toBe(false)

      controller.destroy()
    })

    it("data-default-open='false' keeps collapsible closed", () => {
      document.body.innerHTML = `
        <div data-slot="collapsible" id="root" data-default-open="false">
          <button data-slot="collapsible-trigger">Toggle</button>
          <div data-slot="collapsible-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const controller = createCollapsible(root)

      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it('data-hidden-until-found sets hidden="until-found" when closed', () => {
      document.body.innerHTML = `
        <div data-slot="collapsible" id="root" data-hidden-until-found>
          <button data-slot="collapsible-trigger">Toggle</button>
          <div data-slot="collapsible-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="collapsible-content"]') as HTMLElement
      const controller = createCollapsible(root)

      expect(content.getAttribute('hidden')).toBe('until-found')

      controller.destroy()
    })

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="collapsible" id="root" data-default-open>
          <button data-slot="collapsible-trigger">Toggle</button>
          <div data-slot="collapsible-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      // JS option says false, data attribute says true - JS wins
      const controller = createCollapsible(root, { defaultOpen: false })

      expect(controller.isOpen).toBe(false)

      controller.destroy()
    })

    it('JS hiddenUntilFound option overrides data-hidden-until-found', () => {
      document.body.innerHTML = `
        <div data-slot="collapsible" id="root" data-hidden-until-found>
          <button data-slot="collapsible-trigger">Toggle</button>
          <div data-slot="collapsible-content">Content</div>
        </div>
      `
      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="collapsible-content"]') as HTMLElement
      const controller = createCollapsible(root, { hiddenUntilFound: false })

      expect(content.getAttribute('hidden')).toBe('')
      expect(content.getAttribute('hidden')).not.toBe('until-found')

      controller.destroy()
    })
  })
})
