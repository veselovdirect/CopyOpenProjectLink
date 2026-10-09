import { resolveWorkPackageUrl } from './work-package-url-resolver.js';
import { formatMarkdownLink } from './markdown-formatter.js';
import { extractWorkPackageId, ID_NOT_FOUND } from './work-package-id.js';

export const COPY_MODES = Object.freeze({ TITLE: 'title', WORK_PACKAGE_ID: 'work-package-id' });

export function buildPageLink(page, mode = COPY_MODES.TITLE) {
  let text = page.title;
  if (mode === COPY_MODES.WORK_PACKAGE_ID) {
    text = page.isOpenProject ? extractWorkPackageId(page.title) : null;
    if (!text) throw new Error(ID_NOT_FOUND);
  }
  return formatMarkdownLink(text, resolveWorkPackageUrl(page.url, page.isOpenProject));
}
