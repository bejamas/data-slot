import { beforeEach, describe, expect, it } from 'bun:test'
import { getAutofocusOrFirstFocusable, getFocusable, getTabbables } from './focus'

describe('focus eligibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('honors visibility overrides without overriding display-none ancestors', () => {
    document.body.innerHTML = `
      <div style="visibility: hidden">
        <button id="inherited">Hidden</button>
        <button id="visible" style="visibility: visible">Visible</button>
      </div>
      <div style="display: none">
        <button style="visibility: visible">Still hidden</button>
      </div>
    `
    expect(getTabbables(document.body).map((element) => element.id)).toEqual(['visible'])
  })

  it('only includes the first summary of a details element unless tabindex is explicit', () => {
    document.body.innerHTML = `
      <summary>Standalone</summary>
      <details open>
        <summary id="first">First</summary>
        <summary>Second</summary>
        <summary id="explicit" tabindex="-1">Programmatic</summary>
      </details>
      <summary id="standalone" tabindex="0">Explicit standalone</summary>
    `
    expect(getFocusable(document.body).map((element) => element.id)).toEqual(['first', 'explicit', 'standalone'])
    expect(getTabbables(document.body).map((element) => element.id)).toEqual(['first', 'standalone'])
  })

  it('distinguishes editing hosts from nested editable content and respects tabindex', () => {
    document.body.innerHTML = `
      <div id="editor" contenteditable="true">
        <div contenteditable="true">Nested</div>
        <div><div contenteditable="plaintext-only">Inherited through a wrapper</div></div>
        <div id="nested-tab" contenteditable="true" tabindex="0">Tabbable</div>
        <div id="nested-focus" contenteditable="true" tabindex="-1">Programmatic</div>
        <div contenteditable="false"><div id="new-host" contenteditable="TRUE">New host</div></div>
        <button id="button">Native control</button>
      </div>
      <div contenteditable="invalid">Not editable</div>
    `
    expect(getFocusable(document.body).map((element) => element.id)).toEqual([
      'editor', 'nested-tab', 'nested-focus', 'new-host', 'button',
    ])
    expect(getTabbables(document.body).map((element) => element.id)).toEqual([
      'editor', 'nested-tab', 'new-host', 'button',
    ])
  })

  it('does not let hidden inputs or invalid tabindex targets prevent autofocus fallback', () => {
    document.body.innerHTML = `
      <input type="hidden" tabindex="0" autofocus>
      <div tabindex="invalid" autofocus>Invalid</div>
      <summary autofocus>Standalone</summary>
      <button id="action">Action</button>
    `
    expect(getFocusable(document.body).map((element) => element.id)).toEqual(['action'])
    expect(getAutofocusOrFirstFocusable(document.body)?.id).toBe('action')
  })

  it('refreshes radio selection and form ownership between discoveries', () => {
    document.body.innerHTML = `
      <form id="form"><input id="inside" type="radio" name="plan"></form>
      <input id="outside" type="radio" name="plan" form="form" checked>
    `
    const form = document.getElementById('form')!
    const inside = document.getElementById('inside') as HTMLInputElement
    const outside = document.getElementById('outside') as HTMLInputElement
    expect(getTabbables(form)).toEqual([])
    outside.checked = false
    inside.checked = true
    expect(getTabbables(form)).toEqual([inside])
    inside.checked = false
    outside.checked = true
    expect(getTabbables(form)).toEqual([])
    outside.removeAttribute('form')
    expect(getTabbables(form)).toEqual([inside])
    outside.setAttribute('form', 'form')
    expect(getTabbables(form)).toEqual([])
    outside.disabled = true
    expect(getTabbables(form)).toEqual([inside])
  })
})
