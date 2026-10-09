import { createCopyAction, MENU_ID, MENU_TITLE } from './extension-actions.js';
import { createFeedback } from './feedback.js';

const feedback = createFeedback();
const copyPage = createCopyAction(chrome, { feedback });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) return;
    chrome.contextMenus.create({ id: MENU_ID, title: MENU_TITLE, contexts: ['all'] }, () => {
      // Consume install-time errors without producing an unhandled exception.
      void chrome.runtime.lastError;
    });
  });
});

chrome.action.onClicked.addListener((tab) => { void copyPage(tab); });
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Deliberately ignore info.linkUrl and info.frameUrl: always copy the top-level page.
  if (info.menuItemId === MENU_ID) void copyPage(tab);
});
chrome.tabs.onRemoved.addListener((tabId) => feedback.forget(tabId));
