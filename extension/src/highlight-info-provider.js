import { HIGHLIGHT_UNAVAILABLE } from './highlight-link.js';

// Serialized by Chrome; all dependencies live in the isolated world.
export function readHighlightInfo(expectedText) {
  const selection = window.getSelection();
  const text = selection?.toString() ?? '';
  const normalize = (value) => value.replace(/\s+/gu, ' ').trim();
  if (!selection || selection.rangeCount !== 1 || !text.trim()
      || normalize(text) !== normalize(expectedText)) return null;
  const result = globalThis.__copyOpenProjectTextFragments.generateFragment(selection);
  if (result.status !== 0) return null;
  return { text, url: location.href, fragment: result.fragment };
}

export async function getHighlightInfo(tabId, info, api = chrome) {
  // Text Fragments address the main document and cannot target embedded frames
  // or editable values. Never silently link to a different occurrence instead.
  if (info?.editable || (info?.frameId ?? 0) !== 0
      || typeof info?.selectionText !== 'string' || !info.selectionText.trim()) {
    throw new Error(HIGHLIGHT_UNAVAILABLE);
  }
  await api.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: ['vendor/text-fragments.js'],
    world: 'ISOLATED',
  });
  const results = await api.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: readHighlightInfo,
    args: [info.selectionText],
    world: 'ISOLATED',
  });
  const highlight = results.find((entry) => entry.frameId === 0)?.result;
  if (!highlight?.fragment?.textStart || typeof highlight.text !== 'string'
      || typeof highlight.url !== 'string') throw new Error(HIGHLIGHT_UNAVAILABLE);
  return highlight;
}
