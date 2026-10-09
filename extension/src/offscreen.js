export function writePlainText(text, documentObject = document) {
  // Chrome's supported offscreen clipboard recipe uses this DOM compatibility
  // bridge: Async Clipboard rejects unfocused documents. It is isolated here
  // and can be removed when worker clipboard support reaches target browsers.
  const field = documentObject.createElement('textarea');
  field.value = text;
  documentObject.body.append(field);
  field.select();
  try {
    if (!documentObject.execCommand('copy')) throw new Error('CLIPBOARD_UNAVAILABLE');
  } finally {
    field.value = '';
    field.remove();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.target !== 'clipboard' || message.type !== 'write-text') {
    return false;
  }
  if (typeof message.text !== 'string') {
    sendResponse({ ok: false });
    return false;
  }
  try {
    writePlainText(message.text);
    sendResponse({ ok: true });
  } catch {
    sendResponse({ ok: false });
  }
  return false;
});
