import { createCopyAction, MENU_ID, MENU_TITLE, MENU_TITLE_ID, MENU_SHORT_TITLE_ID, MENU_WORK_PACKAGE_ID, MENU_HIGHLIGHT_ID } from './extension-actions.js';
import { COPY_MODES } from './link-builder.js';
import { createFeedback } from './feedback.js';

const feedback = createFeedback();
const copyPage = createCopyAction(chrome, { feedback });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) return;
    chrome.contextMenus.create({ id: MENU_ID, title: MENU_TITLE, contexts: ['all'] }, () => {
      if (chrome.runtime.lastError) return;
      for (const item of [
        { id: MENU_TITLE_ID, title: 'Page title' },
        { id: MENU_SHORT_TITLE_ID, title: 'Short work package title' },
        { id: MENU_WORK_PACKAGE_ID, title: 'Work package ID' },
        { id: MENU_HIGHLIGHT_ID, title: 'Copy link to highlight', contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*'] },
      ]) {
        chrome.contextMenus.create({ contexts: ['all'], ...item, parentId: MENU_ID }, () => {
          // Consume install-time errors without producing an unhandled exception.
          void chrome.runtime.lastError;
        });
      }
    });
  });
});

chrome.action.onClicked.addListener((tab) => { void copyPage(tab); });
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Page modes use the top-level page; highlight mode validates the selection context.
  if (info.menuItemId === MENU_TITLE_ID) void copyPage(tab, COPY_MODES.TITLE);
  else if (info.menuItemId === MENU_SHORT_TITLE_ID) void copyPage(tab, COPY_MODES.SHORT_TITLE);
  else if (info.menuItemId === MENU_WORK_PACKAGE_ID) void copyPage(tab, COPY_MODES.WORK_PACKAGE_ID);
  else if (info.menuItemId === MENU_HIGHLIGHT_ID) void copyPage(tab, COPY_MODES.HIGHLIGHT, info);
});
chrome.tabs.onRemoved.addListener((tabId) => feedback.forget(tabId));
