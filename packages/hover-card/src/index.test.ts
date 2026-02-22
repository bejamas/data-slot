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

    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
    expect(controller.isOpen).toBe(false)

    await wait(15)
    expect(controller.isOpen).toBe(true)

    controller.destroy()
  })

  it('closes on pointerleave after closeDelay', async () => {
    const { trigger, controller } = setup({ delay: 0, closeDelay: 10 })

    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
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

    triggerA.dispatchEvent(pointer('pointerenter', 'mouse'))
    await wait(35)
    expect(firstController.isOpen).toBe(true)

    triggerA.dispatchEvent(pointer('pointerleave', 'mouse'))
    await waitForClose()
    expect(firstController.isOpen).toBe(false)

    triggerB.dispatchEvent(pointer('pointerenter', 'mouse'))
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

    triggerA.dispatchEvent(pointer('pointerenter', 'mouse'))
    await wait(35)
    expect(firstController.isOpen).toBe(true)

    triggerA.dispatchEvent(pointer('pointerleave', 'mouse'))
    await waitForClose()
    expect(firstController.isOpen).toBe(false)

    triggerB.dispatchEvent(pointer('pointerenter', 'mouse'))
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

    triggerA.dispatchEvent(pointer('pointerenter', 'mouse'))
    await wait(35)
    expect(firstController.isOpen).toBe(true)

    triggerA.dispatchEvent(pointer('pointerleave', 'mouse'))
    await waitForClose()
    expect(firstController.isOpen).toBe(false)

    triggerB.dispatchEvent(pointer('pointerenter', 'mouse'))
    await wait(5)
    expect(secondController.isOpen).toBe(true)

    firstController.destroy()
    secondController.destroy()
  })

  it('keeps open while moving from trigger to content', async () => {
    const { trigger, content, controller } = setup({ delay: 0, closeDelay: 20 })

    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
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

  it('opens on focus and closes on blur', async () => {
    const { trigger, controller } = setup({ delay: 0, closeDelay: 0 })

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(controller.isOpen).toBe(true)

    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await waitForClose()
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

  it('sets data-side and data-align from options', () => {
    const { content, controller } = setup({ side: 'right', align: 'end', avoidCollisions: false })

    controller.open()

    expect(content.getAttribute('data-side')).toBe('right')
    expect(content.getAttribute('data-align')).toBe('end')

    controller.destroy()
  })

  it('portals by default and restores on close', async () => {
    const { root, content, controller } = setup({ delay: 0 })
    const originalParent = content.parentNode

    controller.open()
    const positioner = content.parentElement as HTMLElement
    expect(positioner.getAttribute('data-slot')).toBe('hover-card-positioner')
    expect(positioner.parentElement).toBe(document.body)

    controller.close()
    await waitForClose()

    expect(content.parentNode).toBe(originalParent)
    expect(root.contains(content)).toBe(true)

    controller.destroy()
  })

  it('respects portal=false', () => {
    const { root, content, controller } = setup({ delay: 0, portal: false })
    const originalParent = content.parentNode

    controller.open()

    expect(content.parentNode).toBe(originalParent)
    expect(root.contains(content)).toBe(true)

    controller.destroy()
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

    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
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
    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))

    expect(controllers[0]?.isOpen).toBe(true)

    controllers.forEach((controller) => controller.destroy())
  })
})
