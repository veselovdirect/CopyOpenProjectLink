import { getPageInfo } from './page-info-provider.js';
import { buildPageLink, COPY_MODES } from './link-builder.js';
import { ID_NOT_FOUND } from './work-package-id.js';
import { createClipboardService } from './clipboard-service.js';
import { createFeedback } from './feedback.js';

export const MENU_ID = 'copy-openproject-link-as-markdown';
export const MENU_TITLE = 'Copy Page Link as Markdown';
export const MENU_TITLE_ID = `${MENU_ID}-title`;
export const MENU_WORK_PACKAGE_ID = `${MENU_ID}-id`;

export function createCopyAction(api = chrome, dependencies = {}) {
  const pageInfo = dependencies.pageInfo ?? ((tabId) => getPageInfo(tabId, api));
  const clipboard = dependencies.clipboard ?? createClipboardService(api);
  const feedback = dependencies.feedback ?? createFeedback(api);
  // Read each page immediately, then commit clipboard writes in invocation order.
  let queue = Promise.resolve();
  return function copyPage(tab, mode = COPY_MODES.TITLE) {
    if (!Number.isInteger(tab?.id) || tab.id < 0) return Promise.resolve(false);
    const tabId = tab.id;
    // Attach rejection handling immediately while another request is pending.
    const snapshot = Promise.resolve().then(() => pageInfo(tabId)).then(
      (page) => ({ page }), () => ({ failed: true }),
    );
    const next = queue.then(async () => {
      let success = false;
      let errorCode;
      try {
        const result = await snapshot;
        if (result.failed) throw new Error('PAGE_UNAVAILABLE');
        await clipboard.writeText(buildPageLink(result.page, mode));
        success = true;
      } catch (error) {
        if (error?.message === ID_NOT_FOUND) errorCode = ID_NOT_FOUND;
        // User feedback is enough; never log page data or leak unhandled rejections.
      }
      await feedback.show(tabId, success, errorCode).catch(() => {});
      return success;
    });
    queue = next.catch(() => {});
    return next;
  };
}
