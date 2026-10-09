import { createCopyAction, MENU_ID, MENU_TITLE, MENU_TITLE_ID, MENU_WORK_PACKAGE_ID } from './extension-actions.js';
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
        { id: MENU_TITLE_ID, title: 'Use page title' },
        { id: MENU_WORK_PACKAGE_ID, title: 'Use work package ID' },
      ]) {
        chrome.contextMenus.create({ ...item, parentId: MENU_ID, contexts: ['all'] }, () => {
          // Consume install-time errors without producing an unhandled exception.
          void chrome.runtime.lastError;
        });
      }
    });
  });
});

chrome.action.onClicked.addListener((tab) => { void copyPage(tab); });
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Deliberately ignore info.linkUrl and info.frameUrl: always copy the top-level page.
  if (info.menuItemId === MENU_TITLE_ID) void copyPage(tab, COPY_MODES.TITLE);
  else if (info.menuItemId === MENU_WORK_PACKAGE_ID) void copyPage(tab, COPY_MODES.WORK_PACKAGE_ID);
});
chrome.tabs.onRemoved.addListener((tabId) => feedback.forget(tabId));
