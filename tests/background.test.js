import test from 'node:test';
import assert from 'node:assert/strict';

test('toolbar and link context menu share the page pipeline and contain errors', async () => {
  const listeners = {}, injected = [], writes = [], titles = new Map();
  const event = (name) => ({ addListener: (listener) => { listeners[name] = listener; } });
  let menu;
  globalThis.chrome = {
    runtime: {
      id: 'test', onInstalled: event('installed'),
      getURL: (path) => `chrome-extension://test/${path}`,
      getContexts: async () => [],
      sendMessage: async (message) => { writes.push(message.text); return { ok: true }; },
    },
    contextMenus: {
      onClicked: event('menu'), removeAll: (callback) => callback(),
      create: (options, callback) => { menu = options; callback(); },
    },
    action: {
      onClicked: event('action'),
      setIcon: async () => {}, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {},
      setTitle: async ({ tabId, title }) => { titles.set(tabId, title); },
    },
    tabs: { onRemoved: event('removed') },
    scripting: { executeScript: async ({ target }) => {
      injected.push(target);
      return [{ frameId: 0, result: { title: `Page ${target.tabId}`, url: `https://host/${target.tabId}?keep#fragment`, isOpenProject: false } }];
    } },
    offscreen: { createDocument: async () => {}, closeDocument: async () => {} },
  };
  try {
    await import('../extension/src/background.js');
    listeners.installed();
    assert.deepEqual(menu, { id: 'copy-openproject-link-as-markdown', title: 'Copy Page Link as Markdown', contexts: ['all'] });
    listeners.menu({ menuItemId: menu.id, linkUrl: 'https://wrong.invalid/', frameUrl: 'https://wrong-frame.invalid/' }, { id: 17 });
    listeners.action({ id: 18 });
    for (let i = 0; i < 10 && writes.length < 2; i++) await new Promise(setImmediate);
    assert.deepEqual(writes, ['[Page 17](https://host/17?keep#fragment)', '[Page 18](https://host/18?keep#fragment)']);
    assert.deepEqual(injected, [{ tabId: 17, frameIds: [0] }, { tabId: 18, frameIds: [0] }]);
    listeners.menu({ menuItemId: 'another-menu' }, { id: 19 });
    assert.equal(injected.length, 2);
    for (let i = 0; i < 10 && titles.size < 2; i++) await new Promise(setImmediate);
    assert.equal(titles.get(17), 'Ссылка скопирована');
    assert.equal(titles.get(18), 'Ссылка скопирована');
  } finally {
    listeners.removed?.(17);
    listeners.removed?.(18);
    delete globalThis.chrome;
  }
});
