let idCounter = 0;

/**
 * Ensure an element has an id, generating one if needed
 */
export const ensureId = (el: Element, prefix: string): string =>
  el.id || (el.id = `${prefix}-${++idCounter}`);

/**
 * Set or remove an ARIA attribute
 * Note: boolean values are converted to strings, use null to remove
 */
export const setAria = (
  el: Element,
  name: string,
  value: string | boolean | null
): void => {
  if (value === null) {
    el.removeAttribute(`aria-${name}`);
  } else {
    el.setAttribute(`aria-${name}`, String(value));
  }
};

/**
 * Link content element to its label and description via ARIA
 */
export const linkLabelledBy = (
  content: Element,
  title?: Element | null,
  description?: Element | null
): void => {
  if (title) {
    content.setAttribute("aria-labelledby", ensureId(title, "title"));
  }
  if (description) {
    content.setAttribute("aria-describedby", ensureId(description, "desc"));
  }
};

