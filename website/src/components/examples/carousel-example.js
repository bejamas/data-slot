/**
 * @param {HTMLElement} root
 * @param {AbortSignal} signal
 */
export function bindCarouselExample(root, signal) {
  const dots = Array.from(root.querySelectorAll('[data-slot="carousel-dot"]'));
  const sync = (index) => dots.forEach((dot, i) => {
    dot.setAttribute('data-state', i === index ? 'active' : 'inactive');
  });

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      root.dispatchEvent(new CustomEvent('carousel:set', { detail: { index } }));
    }, { signal });
  });
  root.addEventListener('carousel:change', event => sync(event.detail.index), { signal });
  sync(Number(root.dataset.index));
}
