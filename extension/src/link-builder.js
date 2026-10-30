import { resolveWorkPackageUrl } from './work-package-url-resolver.js';
import { formatMarkdownLink } from './markdown-formatter.js';
import { extractWorkPackageId, ID_NOT_FOUND } from './work-package-id.js';
import { buildHighlightLink } from './highlight-link.js';
import { shortenWorkPackageTitle } from './work-package-title.js';

export const COPY_MODES = Object.freeze({ TITLE: 'title', SHORT_TITLE: 'short-title', WORK_PACKAGE_ID: 'work-package-id', HIGHLIGHT: 'highlight' });

export function buildPageLink(page, mode = COPY_MODES.TITLE) {
  if (mode === COPY_MODES.HIGHLIGHT) return buildHighlightLink(page);
  let text = page.title;
  if (mode === COPY_MODES.SHORT_TITLE) {
    text = shortenWorkPackageTitle(page.title);
    if (!page.isOpenProject || !extractWorkPackageId(text)) throw new Error(ID_NOT_FOUND);
  }
  if (mode === COPY_MODES.WORK_PACKAGE_ID) {
    text = page.isOpenProject ? extractWorkPackageId(page.title) : null;
    if (!text) throw new Error(ID_NOT_FOUND);
  }
  return formatMarkdownLink(text, resolveWorkPackageUrl(page.url, page.isOpenProject));
}
