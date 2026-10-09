import test from 'node:test';
import assert from 'node:assert/strict';

test('toolbar and link context menu share the page pipeline and contain errors', async () => {
  const listeners = {}, injected = [], writes = [], titles = new Map();
  const event = (name) => ({ addListener: (listener) => { listeners[name] = listener; } });
  const menus = [];
  globalThis.chrome = {
    runtime: {
      id: 'test', onInstalled: event('installed'),
      getURL: (path) => `chrome-extension://test/${path}`,
      getContexts: async () => [],
      sendMessage: async (message) => { writes.push(message.text); return { ok: true }; },
    },
    contextMenus: {
      onClicked: event('menu'), removeAll: (callback) => callback(),
      create: (options, callback) => { menus.push(options); callback(); },
    },
    action: {
      onClicked: event('action'),
      setIcon: async () => {}, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {},
      setTitle: async ({ tabId, title }) => { titles.set(tabId, title); },
    },
    tabs: { onRemoved: event('removed') },
    scripting: { executeScript: async ({ target }) => {
      injected.push(target);
      const task = target.tabId === 19;
      return [{ frameId: 0, result: {
        title: task ? 'Task (112554)' : `Page ${target.tabId}`,
        url: task ? 'https://host/notifications/details/112554/activity?facet=all' : `https://host/${target.tabId}?keep#fragment`,
        isOpenProject: task,
      } }];
    } },
    offscreen: { createDocument: async () => {}, closeDocument: async () => {} },
  };
  try {
    await import('../extension/src/background.js');
    listeners.installed();
    const parentId = 'copy-openproject-link-as-markdown';
    assert.deepEqual(menus, [
      { id: parentId, title: 'Copy Page Link as Markdown', contexts: ['all'] },
      { id: `${parentId}-title`, title: 'Use page title', parentId, contexts: ['all'] },
      { id: `${parentId}-id`, title: 'Use work package ID', parentId, contexts: ['all'] },
    ]);
    listeners.menu({ menuItemId: `${parentId}-title`, linkUrl: 'https://wrong.invalid/', frameUrl: 'https://wrong-frame.invalid/' }, { id: 17 });
    listeners.action({ id: 18 });
    listeners.menu({ menuItemId: `${parentId}-id`, linkUrl: 'https://wrong.invalid/' }, { id: 19 });
    listeners.action({ id: 19 });
    for (let i = 0; i < 10 && writes.length < 4; i++) await new Promise(setImmediate);
    assert.deepEqual(writes, [
      '[Page 17](https://host/17?keep#fragment)', '[Page 18](https://host/18?keep#fragment)',
      '[112554](https://host/work_packages/112554)', '[Task \\(112554\\)](https://host/work_packages/112554)',
    ]);
    assert.deepEqual(injected.map((item) => item.tabId), [17, 18, 19, 19]);
    assert.ok(injected.every((item) => item.frameIds.length === 1 && item.frameIds[0] === 0));
    listeners.menu({ menuItemId: 'another-menu' }, { id: 20 });
    listeners.menu({ menuItemId: parentId }, { id: 20 });
    assert.equal(injected.length, 4);
    for (let i = 0; i < 10 && titles.size < 3; i++) await new Promise(setImmediate);
    assert.equal(titles.get(17), 'Ссылка скопирована');
    assert.equal(titles.get(18), 'Ссылка скопирована');
  } finally {
    listeners.removed?.(17);
    listeners.removed?.(18);
    listeners.removed?.(19);
    delete globalThis.chrome;
  }
});
