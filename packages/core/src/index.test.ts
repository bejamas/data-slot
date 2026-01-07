import { describe, expect, it } from 'bun:test'
import { getPart, getParts, getRoots } from './index'
import { ensureId, setAria, linkLabelledBy } from './index'
import { on, emit, composeHandlers } from './index'

describe('core/parts', () => {
  it('getPart finds a single slot', () => {
    document.body.innerHTML = `
      <div id="root">
        <button data-slot="trigger">Click</button>
        <div data-slot="content">Content</div>
      </div>
    `
    const root = document.getElementById('root')!
    const trigger = getPart(root, 'trigger')
    expect(trigger).toBeTruthy()
    expect(trigger?.textContent).toBe('Click')
  })

  it('getPart returns null when not found', () => {
    document.body.innerHTML = `<div id="root"></div>`
    const root = document.getElementById('root')!
    expect(getPart(root, 'missing')).toBeNull()
  })

  it('getParts finds multiple slots', () => {
    document.body.innerHTML = `
      <div id="root">
        <button data-slot="item">One</button>
        <button data-slot="item">Two</button>
        <button data-slot="item">Three</button>
      </div>
    `
    const root = document.getElementById('root')!
    const items = getParts(root, 'item')
    expect(items).toHaveLength(3)
  })

  it('getRoots finds all component roots by data-slot', () => {
    document.body.innerHTML = `
      <div data-slot="dialog">Dialog 1</div>
      <div data-slot="tabs">Tabs</div>
      <div data-slot="dialog">Dialog 2</div>
    `
    const dialogs = getRoots(document, 'dialog')
    expect(dialogs).toHaveLength(2)
  })
})

describe('core/aria', () => {
  it('ensureId generates an id if missing', () => {
    document.body.innerHTML = `<div id="test"></div><div></div>`
    const withId = document.getElementById('test')!
    const withoutId = document.body.lastElementChild!

    expect(ensureId(withId, 'prefix')).toBe('test')
    const generated = ensureId(withoutId, 'prefix')
    expect(generated).toMatch(/^prefix-\d+$/)
    expect(withoutId.id).toBe(generated)
  })

  it('setAria sets and removes attributes', () => {
    document.body.innerHTML = `<button></button>`
    const btn = document.querySelector('button')!

    setAria(btn, 'expanded', true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')

    setAria(btn, 'expanded', false)
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    setAria(btn, 'label', 'Test')
    expect(btn.getAttribute('aria-label')).toBe('Test')

    setAria(btn, 'label', null)
    expect(btn.hasAttribute('aria-label')).toBe(false)
  })

  it('linkLabelledBy links content to title and description', () => {
    document.body.innerHTML = `
      <div id="content"></div>
      <h2 id="title">Title</h2>
      <p>Description</p>
    `
    const content = document.getElementById('content')!
    const title = document.getElementById('title')!
    const desc = document.querySelector('p')!

    linkLabelledBy(content, title, desc)

    expect(content.getAttribute('aria-labelledby')).toBe('title')
    expect(content.hasAttribute('aria-describedby')).toBe(true)
    expect(desc.id).toBeTruthy()
  })
})

describe('core/events', () => {
  it('on adds and removes event listener', () => {
    document.body.innerHTML = `<button>Click</button>`
    const btn = document.querySelector('button')!

    let clicked = false
    const cleanup = on(btn, 'click', () => {
      clicked = true
    })

    btn.click()
    expect(clicked).toBe(true)

    clicked = false
    cleanup()
    btn.click()
    expect(clicked).toBe(false)
  })

  it('emit dispatches custom event', () => {
    document.body.innerHTML = `<div id="root"></div>`
    const root = document.getElementById('root')!

    let received: unknown = null
    root.addEventListener('test:event', (e) => {
      received = (e as CustomEvent).detail
    })

    emit(root, 'test:event', { foo: 'bar' })
    expect(received).toEqual({ foo: 'bar' })
  })

  it('composeHandlers calls handlers in order', () => {
    const order: number[] = []

    const composed = composeHandlers<Event>(
      () => order.push(1),
      () => order.push(2),
      undefined,
      () => order.push(3)
    )

    composed(new Event('test'))
    expect(order).toEqual([1, 2, 3])
  })

  it('composeHandlers stops on defaultPrevented', () => {
    const order: number[] = []

    const composed = composeHandlers<Event>(
      () => order.push(1),
      (e) => {
        order.push(2)
        e.preventDefault()
      },
      () => order.push(3)
    )

    const event = new Event('test', { cancelable: true })
    composed(event)
    expect(order).toEqual([1, 2])
  })
})

