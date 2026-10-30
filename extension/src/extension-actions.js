import { getPageInfo } from './page-info-provider.js';
import { getHighlightInfo } from './highlight-info-provider.js';
import { HIGHLIGHT_UNAVAILABLE } from './highlight-link.js';
import { buildPageLink, COPY_MODES } from './link-builder.js';
import { ID_NOT_FOUND } from './work-package-id.js';
import { createClipboardService } from './clipboard-service.js';
import { createFeedback } from './feedback.js';
import { getToolbarMode } from './settings.js';

export const MENU_ID = 'copy-openproject-link-as-markdown';
export const MENU_TITLE = 'Copy link as Markdown';
export const MENU_TITLE_ID = `${MENU_ID}-title`;
export const MENU_SHORT_TITLE_ID = `${MENU_ID}-short-title`;
export const MENU_WORK_PACKAGE_ID = `${MENU_ID}-id`;
export const MENU_HIGHLIGHT_ID = `${MENU_ID}-highlight`;

export function createCopyAction(api = chrome, dependencies = {}) {
  const pageInfo = dependencies.pageInfo ?? ((tabId) => getPageInfo(tabId, api));
  const highlightInfo = dependencies.highlightInfo ?? ((tabId, info) => getHighlightInfo(tabId, info, api));
  const clipboard = dependencies.clipboard ?? createClipboardService(api);
  const feedback = dependencies.feedback ?? createFeedback(api);
  const toolbarMode = dependencies.toolbarMode ?? (() => getToolbarMode(api));
  // Read each page immediately, then commit clipboard writes in invocation order.
  let queue = Promise.resolve();
  return function copyPage(tab, mode, info) {
    if (!Number.isInteger(tab?.id) || tab.id < 0) return Promise.resolve(false);
    const tabId = tab.id;
    // Attach rejection handling immediately while another request is pending.
    const snapshot = Promise.resolve().then(() => Promise.all([
      mode === COPY_MODES.HIGHLIGHT ? highlightInfo(tabId, info) : pageInfo(tabId),
      mode === undefined ? toolbarMode() : mode,
    ])).then(
      ([page, selectedMode]) => ({ page, mode: selectedMode }),
      () => ({ failed: true, errorCode: mode === COPY_MODES.HIGHLIGHT ? HIGHLIGHT_UNAVAILABLE : 'PAGE_UNAVAILABLE' }),
    );
    const next = queue.then(async () => {
      let success = false;
      let errorCode;
      try {
        const result = await snapshot;
        if (result.failed) throw new Error(result.errorCode);
        await clipboard.writeText(buildPageLink(result.page, result.mode));
        success = true;
      } catch (error) {
        if (error?.message === ID_NOT_FOUND) errorCode = ID_NOT_FOUND;
        if (error?.message === HIGHLIGHT_UNAVAILABLE) errorCode = HIGHLIGHT_UNAVAILABLE;
        // User feedback is enough; never log page data or leak unhandled rejections.
      }
      await feedback.show(tabId, success, errorCode).catch(() => {});
      return success;
    });
    queue = next.catch(() => {});
    return next;
  };
}
