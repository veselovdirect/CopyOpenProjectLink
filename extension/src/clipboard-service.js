export function createClipboardService(api = chrome, workerClipboard = globalThis.navigator?.clipboard) {
  let queue = Promise.resolve();
  async function write(text) {
    if (workerClipboard?.writeText) {
      await workerClipboard.writeText(text);
      return;
    }
    const url = api.runtime.getURL('offscreen.html');
    const contexts = await api.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url],
    });
    if (!contexts.length) {
      await api.offscreen.createDocument({
        url: 'offscreen.html', reasons: ['CLIPBOARD'],
        justification: 'Copy the requested Markdown link to the clipboard without opening a window.',
      });
    }
    try {
      const result = await api.runtime.sendMessage({ target: 'clipboard', type: 'write-text', text });
      if (!result?.ok) throw new Error('CLIPBOARD_UNAVAILABLE');
    } finally {
      // No hidden document remains running after a copy, including failed writes.
      await api.offscreen.closeDocument().catch(() => {});
    }
  }
  return {
    writeText(text) {
      const next = queue.then(() => write(text));
      queue = next.catch(() => {});
      return next;
    },
  };
}
