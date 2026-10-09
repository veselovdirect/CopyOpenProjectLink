import { OPENPROJECT_SELECTORS } from './openproject-detector.js';

// Chrome serializes this function: it must not close over module variables.
export function readPageInfo(selectors) {
  return {
    title: document.title,
    url: location.href,
    isOpenProject: selectors.some((selector) => Boolean(document.head?.querySelector(selector))),
  };
}

export async function getPageInfo(tabId, api = chrome) {
  const results = await api.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: readPageInfo,
    args: [OPENPROJECT_SELECTORS],
    world: 'ISOLATED',
  });
  const page = results.find((entry) => entry.frameId === 0)?.result;
  if (!page || typeof page.title !== 'string' || typeof page.url !== 'string') {
    throw new Error('PAGE_UNAVAILABLE');
  }
  return page;
}
