import { formatMarkdownLink } from './markdown-formatter.js';

export const HIGHLIGHT_UNAVAILABLE = 'HIGHLIGHT_UNAVAILABLE';

// Collapse HTML whitespace in every selector field before URL encoding.
// Hyphens and commas delimit Text Fragment fields; encode them inside fields.
const encode = (text) => encodeURIComponent(text.replace(/\s+/gu, ' ').trim()).replace(/[!'()*-]/g,
  (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

export function buildHighlightLink({ text, url: originalUrl, fragment }) {
  if (typeof text !== 'string' || !text.trim() || !fragment?.textStart) {
    throw new Error(HIGHLIGHT_UNAVAILABLE);
  }
  const url = new URL(originalUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(HIGHLIGHT_UNAVAILABLE);
  const directive = [
    fragment.prefix ? `${encode(fragment.prefix)}-,` : '',
    encode(fragment.textStart),
    fragment.textEnd ? `,${encode(fragment.textEnd)}` : '',
    fragment.suffix ? `,-${encode(fragment.suffix)}` : '',
  ].join('');
  // Keep the view, query and ordinary anchor, replacing any old directives.
  url.hash = `${url.hash.split(':~:')[0]}:~:text=${directive}`;
  return formatMarkdownLink(text, url.href);
}
