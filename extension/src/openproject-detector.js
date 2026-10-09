// A serializable detector specification shared with the injected page reader.
// Add DOM signals here without changing URL resolution or Markdown formatting.
export const OPENPROJECT_SELECTORS = Object.freeze([
  'meta[name="openproject_initializer"]',
]);

export function isOpenProject(document, selectors = OPENPROJECT_SELECTORS) {
  return selectors.some((selector) => Boolean(document.head?.querySelector(selector)));
}
