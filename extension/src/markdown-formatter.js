export function escapeMarkdownTitle(title) {
  // Prevent HTML/entities and inline Markdown from changing the visible title.
  return title
    .replace(/[\r\n\t\u2028\u2029]+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&');
}

export function escapeMarkdownUrl(url) {
  // Encode destination delimiters only. Existing queries, hashes and escapes stay intact.
  return url.replace(/[\s()<>\\]/gu, (character) => encodeURIComponent(character)
    .replace(/\(/g, '%28').replace(/\)/g, '%29'));
}

export function formatMarkdownLink(title, url) {
  return `[${escapeMarkdownTitle(title)}](${escapeMarkdownUrl(url)})`;
}
