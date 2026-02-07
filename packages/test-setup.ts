import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

if (!window.visualViewport) {
  const viewportEvents = new EventTarget()
  const visualViewport = {
    get width() {
      return window.innerWidth
    },
    get height() {
      return window.innerHeight
    },
    get offsetLeft() {
      return 0
    },
    get offsetTop() {
      return 0
    },
    addEventListener: viewportEvents.addEventListener.bind(viewportEvents),
    removeEventListener: viewportEvents.removeEventListener.bind(viewportEvents),
    dispatchEvent: viewportEvents.dispatchEvent.bind(viewportEvents),
  } as unknown as VisualViewport

  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  })
}
