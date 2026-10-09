import { resolveWorkPackageUrl } from './work-package-url-resolver.js';
import { formatMarkdownLink } from './markdown-formatter.js';

export function buildPageLink(page) {
  return formatMarkdownLink(page.title, resolveWorkPackageUrl(page.url, page.isOpenProject));
}
