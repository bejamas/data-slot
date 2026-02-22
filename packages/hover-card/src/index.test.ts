import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { createHoverCard, create } from './index'

describe('HoverCard', () => {
  const setup = (options: Parameters<typeof createHoverCard>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="hover-card" id="root">
        <button data-slot="hover-card-trigger">Hover me</button>
        <div data-slot="hover-card-content">Preview content</div>
      </div>
    `

    const root = document.getElementById('root')!
    const trigger = root.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
    const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
    const controller = createHoverCard(root, options)

    return { root, trigger, content, controller }
  }

  const setupTwo = (
    first: Parameters<typeof createHoverCard>[1] = {},
    second: Parameters<typeof createHoverCard>[1] = {},
    firstAttrs = '',
    secondAttrs = ''
  ) => {
    document.body.innerHTML = `
      <div data-slot="hover-card" id="root-a" ${firstAttrs}>
        <button data-slot="hover-card-trigger">A</button>
        <div data-slot="hover-card-content">A content</div>
      </div>
      <div data-slot="hover-card" id="root-b" ${secondAttrs}>
        <button data-slot="hover-card-trigger">B</button>
        <div data-slot="hover-card-content">B content</div>
      </div>
    `

    const rootA = document.getElementById('root-a')!
    const rootB = document.getElementById('root-b')!
    const triggerA = rootA.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
    const triggerB = rootB.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
    const firstController = createHoverCard(rootA, first)
    const secondController = createHoverCard(rootB, second)

    return { triggerA, triggerB, firstController, secondController }
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

  const waitForClose = async () => {
    await waitForRaf()
    await waitForRaf()
  }

  const getPositioner = (content: HTMLElement): HTMLElement => {
    const parent = content.parentElement
    if (parent && parent.getAttribute('data-slot') === 'hover-card-positioner') {
      return parent
    }
    return content
  }

  const getTranslate3dXY = (transform: string): { x: number; y: number } => {
    const match = /translate3d\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*,\s*0(?:px)?\s*\)/.exec(
      transform
    )
    if (!match) {
      throw new Error(`Expected translate3d transform, got \"${transform}\"`)
    }
    return { x: Number(match[1]), y: Number(match[2]) }
  }

  const pointer = (type: string, pointerType: string, relatedTarget?: EventTarget | null) => {
    const event = new PointerEvent(type, { bubbles: true, pointerType })
    if (relatedTarget !== undefined) {
      Object.defineProperty(event, 'relatedTarget', {
        configurable: true,
        value: relatedTarget,
      })
    }
    return event
  }

  const hoverEnter = (el: HTMLElement) => {
    document.dispatchEvent(pointer('pointermove', 'mouse'))
    el.dispatchEvent(pointer('pointerenter', 'mouse'))
  }

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('initializes closed by default', () => {
    const { root, content, trigger, controller } = setup()

    expect(controller.isOpen).toBe(false)
    expect(content.hidden).toBe(true)
    expect(root.getAttribute('data-state')).toBe('closed')
    expect(content.getAttribute('data-state')).toBe('closed')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    controller.destroy()
  })

  it('sets trigger ARIA attributes', () => {
    const { trigger, content, controller } = setup()

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-controls')).toBe(content.id)

    controller.destroy()
  })

  it('opens and closes via controller methods', async () => {
    const { root, content, controller } = setup()

    controller.open()
    expect(controller.isOpen).toBe(true)
    expect(root.getAttribute('data-state')).toBe('open')
    expect(content.hidden).toBe(false)

    controller.close()
    await waitForClose()
    expect(controller.isOpen).toBe(false)
    expect(root.getAttribute('data-state')).toBe('closed')
    expect(content.hidden).toBe(true)

    controller.destroy()
  })

  it('toggle() toggles state', async () => {
    const { controller } = setup()

    controller.toggle()
    expect(controller.isOpen).toBe(true)

    controller.toggle()
    await waitForClose()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('supports defaultOpen option', () => {
    const { root, content, controller } = setup({ defaultOpen: true })

    expect(controller.isOpen).toBe(true)
    expect(root.getAttribute('data-state')).toBe('open')
    expect(content.hidden).toBe(false)

    controller.destroy()
  })

  it('opens on pointerenter (non-touch) after delay', async () => {
    const { trigger, controller } = setup({ delay: 10, skipDelayDuration: 0 })

    hoverEnter(trigger)
    expect(controller.isOpen).toBe(false)

    await wait(15)
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('closes on pointerleave after closeDelay', async () => {
    const { trigger, controller } = setup({ delay: 0, closeDelay: 10 })

    hoverEnter(trigger)
    expect(controller.isOpen).toBe(true)

    trigger.dispatchEvent(pointer('pointerleave', 'mouse'))
    expect(controller.isOpen).toBe(true)

    await wait(15)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('skips delay during warm-up window across hover-cards', async () => {
    const { triggerA, triggerB, firstController, secondController } = setupTwo(
      { delay: 30, closeDelay: 0, skipDelayDuration: 120 },
      { delay: 30, closeDelay: 0, skipDelayDuration: 120 }
    )

    hoverEnter(triggerA)
    await wait(35)
    expect(firstController.isOpen).toBe(true)

    triggerA.dispatchEvent(pointer('pointerleave', 'mouse'))
    await waitForClose()
    expect(firstController.isOpen).toBe(false)

    hoverEnter(triggerB)
    await wait(5)
    expect(secondController.isOpen).toBe(true)

    firstController.destroy()
    secondController.destroy()
  })

  it('respects skipDelayDuration=0 and keeps normal delay between hover-cards', async () => {
    const { triggerA, triggerB, firstController, secondController } = setupTwo(
      { delay: 30, closeDelay: 0, skipDelayDuration: 0 },
      { delay: 30, closeDelay: 0, skipDelayDuration: 0 }
    )

    hoverEnter(triggerA)
    await wait(35)
    expect(firstController.isOpen).toBe(true)

    triggerA.dispatchEvent(pointer('pointerleave', 'mouse'))
    await waitForClose()
    expect(firstController.isOpen).toBe(false)

    hoverEnter(triggerB)
    await wait(5)
    expect(secondController.isOpen).toBe(false)

    await wait(35)
    expect(secondController.isOpen).toBe(true)

    firstController.destroy()
    secondController.destroy()
  })

  it('reads data-skip-delay-duration from root', async () => {
    const attrs = 'data-delay="30" data-close-delay="0" data-skip-delay-duration="120"'
    const { triggerA, triggerB, firstController, secondController } = setupTwo({}, {}, attrs, attrs)

    hoverEnter(triggerA)
    await wait(35)
    expect(firstController.isOpen).toBe(true)

    triggerA.dispatchEvent(pointer('pointerleave', 'mouse'))
    await waitForClose()
    expect(firstController.isOpen).toBe(false)

    hoverEnter(triggerB)
    await wait(5)
    expect(secondController.isOpen).toBe(true)

    firstController.destroy()
    secondController.destroy()
  })

  it('keeps open while moving from trigger to content', async () => {
    const { trigger, content, controller } = setup({ delay: 0, closeDelay: 20 })

    hoverEnter(trigger)
    expect(controller.isOpen).toBe(true)

    trigger.dispatchEvent(pointer('pointerleave', 'mouse'))
    await wait(5)
    content.dispatchEvent(pointer('pointerenter', 'mouse'))

    await wait(25)
    expect(controller.isOpen).toBe(true)

    content.dispatchEvent(pointer('pointerleave', 'mouse'))
    await wait(25)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('ignores touch hover interaction', () => {
    const { trigger, controller } = setup({ delay: 0 })

    trigger.dispatchEvent(pointer('pointerenter', 'touch'))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('does not open on pointerenter without pointer-move intent', () => {
    const { trigger, controller } = setup({ delay: 0 })

    document.dispatchEvent(pointer('pointerdown', 'mouse'))
    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('opens on focus and closes on blur', async () => {
    const { trigger, controller } = setup({ delay: 0, closeDelay: 0 })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(controller.isOpen).toBe(true)

    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await waitForClose()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('does not open on programmatic focus without keyboard intent', () => {
    const { trigger, controller } = setup({ delay: 0, closeDelay: 0 })

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('closes on Escape by default', async () => {
    const { controller } = setup({ delay: 0 })

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await waitForClose()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('respects closeOnEscape=false', () => {
    const { controller } = setup({ delay: 0, closeOnEscape: false })

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('closes on outside click by default', async () => {
    const { controller } = setup({ delay: 0 })

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await waitForClose()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('respects closeOnClickOutside=false', () => {
    const { controller } = setup({ delay: 0, closeOnClickOutside: false })

    controller.open()
    expect(controller.isOpen).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  describe('content positioning', () => {
    const rect = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }) as DOMRect

    it('uses absolute positioning when open', () => {
      const { content, controller } = setup()

      controller.open()
      const positioner = getPositioner(content)
      expect(positioner.getAttribute('data-slot')).toBe('hover-card-positioner')
      expect(positioner.style.position).toBe('absolute')
      expect(positioner.style.top).toBe('0px')
      expect(positioner.style.left).toBe('0px')
      expect(positioner.style.transform).toContain('translate3d(')
      expect(content.style.transform).toBe('')
      expect(positioner.getAttribute('data-side')).toBe(content.getAttribute('data-side'))
      expect(positioner.getAttribute('data-align')).toBe(content.getAttribute('data-align'))

      controller.destroy()
    })

    it('sets default data-side and data-align attributes when open', () => {
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

    it('applies sideOffset and alignOffset from options', async () => {
      const { trigger, content, controller } = setup({
        side: 'left',
        align: 'start',
        sideOffset: 8,
        alignOffset: 6,
        avoidCollisions: false,
      })

      trigger.getBoundingClientRect = () => rect(200, 120, 80, 20)
      content.getBoundingClientRect = () => rect(0, 0, 100, 40)

      controller.open()
      await waitForRaf()

      const { x, y } = getTranslate3dXY(getPositioner(content).style.transform)
      expect(x).toBe(92)
      expect(y).toBe(126)

      controller.destroy()
    })

    it('uses end alignment edge for alignOffset', async () => {
      const { trigger, content, controller } = setup({
        side: 'top',
        align: 'end',
        sideOffset: 4,
        alignOffset: 10,
        avoidCollisions: false,
      })

      trigger.getBoundingClientRect = () => rect(100, 200, 100, 20)
      content.getBoundingClientRect = () => rect(0, 0, 40, 30)

      controller.open()
      await waitForRaf()

      const { x, y } = getTranslate3dXY(getPositioner(content).style.transform)
      expect(x).toBe(150)
      expect(y).toBe(166)

      controller.destroy()
    })

    it('resolves sideOffset/alignOffset as options > content attrs > root attrs', async () => {
      document.body.innerHTML = `
        <div
          data-slot="hover-card"
          id="root"
          data-side-offset="40"
          data-align-offset="30"
        >
          <button data-slot="hover-card-trigger">Hover me</button>
          <div data-slot="hover-card-content" data-side-offset="12" data-align-offset="7">
            Preview content
          </div>
        </div>
      `

      const root = document.getElementById('root')!
      const trigger = root.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
      const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
      const controller = createHoverCard(root, {
        side: 'left',
        align: 'start',
        sideOffset: 4,
        alignOffset: 3,
        avoidCollisions: false,
      })

      trigger.getBoundingClientRect = () => rect(200, 120, 80, 20)
      content.getBoundingClientRect = () => rect(0, 0, 100, 40)

      controller.open()
      await waitForRaf()

      const { x, y } = getTranslate3dXY(getPositioner(content).style.transform)
      expect(x).toBe(96)
      expect(y).toBe(123)

      controller.destroy()
    })

    it('reads sideOffset/alignOffset from content first, then root', async () => {
      document.body.innerHTML = `
        <div
          data-slot="hover-card"
          id="root"
          data-side="left"
          data-align="start"
          data-side-offset="40"
          data-align-offset="30"
        >
          <button data-slot="hover-card-trigger">Hover me</button>
          <div data-slot="hover-card-content" data-side-offset="12" data-align-offset="7">
            Preview content
          </div>
        </div>
      `

      const root = document.getElementById('root')!
      const trigger = root.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
      const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
      const controller = createHoverCard(root, { avoidCollisions: false })

      trigger.getBoundingClientRect = () => rect(200, 120, 80, 20)
      content.getBoundingClientRect = () => rect(0, 0, 100, 40)

      controller.open()
      await waitForRaf()

      const { x, y } = getTranslate3dXY(getPositioner(content).style.transform)
      expect(x).toBe(88)
      expect(y).toBe(127)

      controller.destroy()
    })

    it('flips side on collision when avoidCollisions is true', async () => {
      const { trigger, content, controller } = setup({
        side: 'bottom',
        align: 'start',
        sideOffset: 4,
        avoidCollisions: true,
        collisionPadding: 8,
      })

      trigger.getBoundingClientRect = () => rect(100, 740, 80, 20)
      content.getBoundingClientRect = () => rect(0, 0, 120, 100)

      controller.open()
      await waitForRaf()

      expect(content.getAttribute('data-side')).toBe('top')
      const { y } = getTranslate3dXY(getPositioner(content).style.transform)
      expect(y).toBe(636)

      controller.destroy()
    })

    it('keeps preferred side when avoidCollisions is false', async () => {
      const { trigger, content, controller } = setup({
        side: 'bottom',
        align: 'start',
        sideOffset: 4,
        avoidCollisions: false,
      })

      trigger.getBoundingClientRect = () => rect(100, 740, 80, 20)
      content.getBoundingClientRect = () => rect(0, 0, 120, 100)

      controller.open()
      await waitForRaf()

      expect(content.getAttribute('data-side')).toBe('bottom')
      const { y } = getTranslate3dXY(getPositioner(content).style.transform)
      expect(y).toBe(764)

      controller.destroy()
    })

    it('keeps coordinates stable on window scroll', async () => {
      const { trigger, content, controller } = setup({ avoidCollisions: false })

      let anchorTop = 120
      const anchorLeft = 80
      const anchorWidth = 140
      const anchorHeight = 32

      trigger.getBoundingClientRect = () =>
        ({
          x: anchorLeft,
          y: anchorTop,
          top: anchorTop,
          left: anchorLeft,
          width: anchorWidth,
          height: anchorHeight,
          right: anchorLeft + anchorWidth,
          bottom: anchorTop + anchorHeight,
          toJSON: () => ({}),
        }) as DOMRect

      content.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          width: 180,
          height: 100,
          right: 180,
          bottom: 100,
          toJSON: () => ({}),
        }) as DOMRect

      controller.open()
      await waitForRaf()
      await waitForRaf()

      const positioner = getPositioner(content)
      const initialTransform = positioner.style.transform

      anchorTop = 260
      window.dispatchEvent(new Event('scroll'))
      await waitForRaf()
      await waitForRaf()

      expect(positioner.style.transform).toBe(initialTransform)
      controller.destroy()
    })
  })

  describe('content portaling', () => {
    it('portals by default and restores on close', async () => {
      const { root, content, controller } = setup({ delay: 0 })
      const originalParent = content.parentNode

      controller.open()
      const positioner = getPositioner(content)
      expect(positioner.getAttribute('data-slot')).toBe('hover-card-positioner')
      expect(positioner.parentElement).toBe(document.body)

      controller.close()
      await waitForClose()

      expect(content.parentNode).toBe(originalParent)
      expect(root.contains(content)).toBe(true)

      controller.destroy()
    })

    it('respects portal=false and positions content directly', () => {
      const { root, content, controller } = setup({ delay: 0, portal: false })
      const originalParent = content.parentNode

      controller.open()

      expect(content.parentNode).toBe(originalParent)
      expect(root.contains(content)).toBe(true)
      expect(getPositioner(content)).toBe(content)
      expect(content.style.position).toBe('absolute')
      expect(content.style.top).toBe('0px')
      expect(content.style.left).toBe('0px')
      expect(content.style.transform).toContain('translate3d(')

      controller.destroy()
    })

    it('reads data-portal from content first, then root', () => {
      document.body.innerHTML = `
        <div data-slot="hover-card" id="root" data-portal="true">
          <button data-slot="hover-card-trigger">Hover me</button>
          <div data-slot="hover-card-content" data-portal="false">Preview content</div>
        </div>
      `

      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
      const originalParent = content.parentNode
      const controller = createHoverCard(root, { delay: 0 })

      controller.open()
      expect(content.parentNode).toBe(originalParent)
      expect(root.contains(content)).toBe(true)

      controller.destroy()
    })

    it("reads data-portal='false' from root", () => {
      document.body.innerHTML = `
        <div data-slot="hover-card" id="root" data-portal="false">
          <button data-slot="hover-card-trigger">Hover me</button>
          <div data-slot="hover-card-content">Preview content</div>
        </div>
      `

      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
      const originalParent = content.parentNode
      const controller = createHoverCard(root, { delay: 0 })

      controller.open()
      expect(content.parentNode).toBe(originalParent)
      expect(root.contains(content)).toBe(true)

      controller.destroy()
    })

    it('restores content to root on destroy while open', () => {
      const { root, content, controller } = setup({ delay: 0 })

      controller.open()
      const positioner = getPositioner(content)
      expect(positioner.parentElement).toBe(document.body)

      controller.destroy()
      expect(root.contains(content)).toBe(true)
    })

    it('uses authored portal and positioner when provided', async () => {
      document.body.innerHTML = `
        <div data-slot="hover-card" id="root">
          <button data-slot="hover-card-trigger">Hover me</button>
          <div data-slot="hover-card-portal" id="portal">
            <div data-slot="hover-card-positioner" id="positioner">
              <div data-slot="hover-card-content">Preview</div>
            </div>
          </div>
        </div>
      `

      const root = document.getElementById('root')!
      const portal = document.getElementById('portal') as HTMLElement
      const positioner = document.getElementById('positioner') as HTMLElement
      const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
      const controller = createHoverCard(root, { delay: 0 })

      controller.open()

      expect(portal.parentElement).toBe(document.body)
      expect(content.parentElement).toBe(positioner)
      expect(positioner.style.transform).toContain('translate3d(')

      controller.close()
      await waitForClose()

      expect(portal.parentElement).toBe(root)
      expect(content.parentElement).toBe(positioner)

      controller.destroy()
    })
  })

  describe('data attributes', () => {
    it('reads data-side and data-align from content first, then root', () => {
      document.body.innerHTML = `
        <div data-slot="hover-card" id="root" data-side="top" data-align="end" data-avoid-collisions="false">
          <button data-slot="hover-card-trigger">Hover me</button>
          <div data-slot="hover-card-content" data-side="right" data-align="start">Preview content</div>
        </div>
      `

      const root = document.getElementById('root')!
      const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement
      const controller = createHoverCard(root, { delay: 0 })

      controller.open()
      expect(content.getAttribute('data-side')).toBe('right')
      expect(content.getAttribute('data-align')).toBe('start')

      controller.destroy()
    })
  })

  it('emits hover-card:change and onOpenChange', () => {
    document.body.innerHTML = `
      <div data-slot="hover-card" id="root">
        <button data-slot="hover-card-trigger">Hover me</button>
        <div data-slot="hover-card-content">Preview</div>
      </div>
    `

    const root = document.getElementById('root')!
    const trigger = root.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
    const content = root.querySelector('[data-slot="hover-card-content"]') as HTMLElement

    let callbackOpen: boolean | undefined
    let eventDetail:
      | { open: boolean; reason: string; trigger: HTMLElement; content: HTMLElement }
      | undefined

    root.addEventListener('hover-card:change', (e) => {
      eventDetail = (e as CustomEvent).detail
    })

    const controller = createHoverCard(root, {
      open: false,
      delay: 0,
      onOpenChange: (open) => {
        callbackOpen = open
      },
    })

    controller.open()

    expect(callbackOpen).toBe(true)
    expect(eventDetail?.open).toBe(true)
    expect(eventDetail?.reason).toBe('api')
    expect(eventDetail?.trigger).toBe(trigger)
    expect(eventDetail?.content).toBe(content)
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('setOpen mutates state in controlled mode', async () => {
    document.body.innerHTML = `
      <div data-slot="hover-card" id="root">
        <button data-slot="hover-card-trigger">Hover me</button>
        <div data-slot="hover-card-content">Preview</div>
      </div>
    `

    const root = document.getElementById('root')!
    const controller = createHoverCard(root, { open: false, delay: 0 })

    expect(controller.isOpen).toBe(false)

    controller.setOpen(true)
    expect(controller.isOpen).toBe(true)

    controller.setOpen(false)
    await waitForClose()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('hover-card:set supports { open } and deprecated { value }', async () => {
    const { root, controller } = setup({ open: false, delay: 0 })

    root.dispatchEvent(new CustomEvent('hover-card:set', { detail: { open: true } }))
    expect(controller.isOpen).toBe(true)

    root.dispatchEvent(new CustomEvent('hover-card:set', { detail: { value: false } }))
    await waitForClose()
    expect(controller.isOpen).toBe(false)

    controller.destroy()
  })

  it('disabled trigger blocks open(), but setOpen() can still force state', () => {
    document.body.innerHTML = `
      <div data-slot="hover-card" id="root">
        <button data-slot="hover-card-trigger" disabled>Hover me</button>
        <div data-slot="hover-card-content">Preview</div>
      </div>
    `

    const root = document.getElementById('root')!
    const trigger = root.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
    const controller = createHoverCard(root, { delay: 0 })

    hoverEnter(trigger)
    expect(controller.isOpen).toBe(false)

    controller.open()
    expect(controller.isOpen).toBe(false)

    controller.setOpen(true)
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('create() binds all hover-cards in scope', () => {
    document.body.innerHTML = `
      <div data-slot="hover-card" data-delay="0">
        <button data-slot="hover-card-trigger">A</button>
        <div data-slot="hover-card-content">A content</div>
      </div>
      <div data-slot="hover-card">
        <button data-slot="hover-card-trigger">B</button>
        <div data-slot="hover-card-content">B content</div>
      </div>
    `

    const controllers = create()
    expect(controllers).toHaveLength(2)

    const trigger = document.querySelector('[data-slot="hover-card-trigger"]') as HTMLElement
    hoverEnter(trigger)

    expect(controllers[0]?.isOpen).toBe(true)

    controllers.forEach((controller) => controller.destroy())
  })
})
