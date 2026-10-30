import test from 'node:test';
import assert from 'node:assert/strict';
import { getToolbarMode, setToolbarMode, TOOLBAR_MODE_KEY } from '../extension/src/settings.js';
import { COPY_MODES } from '../extension/src/link-builder.js';
import { createCopyAction } from '../extension/src/extension-actions.js';

test('toolbar mode defaults to page title and rejects unsupported stored values', async () => {
  for (const value of [undefined, null, 'highlight', 'unknown']) {
    assert.equal(await getToolbarMode({ storage: { local: { get: async () => ({ [TOOLBAR_MODE_KEY]: value }) } } }), COPY_MODES.TITLE);
  }
});

test('persist only one of the three supported toolbar modes', async () => {
  const stored = {};
  const api = { storage: { local: {
    get: async (key) => ({ [key]: stored[key] }),
    set: async (values) => Object.assign(stored, values),
  } } };
  for (const mode of [COPY_MODES.TITLE, COPY_MODES.SHORT_TITLE, COPY_MODES.WORK_PACKAGE_ID]) {
    await setToolbarMode(mode, api);
    assert.equal(await getToolbarMode(api), mode);
    assert.deepEqual(stored, { [TOOLBAR_MODE_KEY]: mode });
  }
  await assert.rejects(setToolbarMode(COPY_MODES.HIGHLIGHT, api), /INVALID_TOOLBAR_MODE/);
  assert.deepEqual(stored, { [TOOLBAR_MODE_KEY]: COPY_MODES.WORK_PACKAGE_ID });
});

test('settings failures propagate instead of falsely reporting a saved preference', async () => {
  const api = { storage: { local: {
    get: async () => { throw new Error('Read denied'); },
    set: async () => { throw new Error('Write denied'); },
  } } };
  await assert.rejects(getToolbarMode(api), /Read denied/);
  await assert.rejects(setToolbarMode(COPY_MODES.TITLE, api), /Write denied/);
});

test('toolbar reads the saved choice for each click while context menu modes stay independent', async () => {
  let mode = COPY_MODES.WORK_PACKAGE_ID;
  const writes = [];
  const api = { storage: { local: { get: async () => ({ [TOOLBAR_MODE_KEY]: mode }) } } };
  const copy = createCopyAction(api, {
    pageInfo: async () => ({ title: 'Bug: Task (42) | Project | OpenProject', url: 'https://host/work_packages/42/activity', isOpenProject: true }),
    clipboard: { writeText: async (text) => writes.push(text) }, feedback: { show: async () => {} },
  });
  assert.equal(await copy({ id: 1 }), true);
  assert.equal(writes.at(-1), '[42](https://host/wp/42)');
  assert.equal(await copy({ id: 1 }, COPY_MODES.TITLE), true);
  assert.equal(writes.at(-1), '[Bug: Task \\(42\\) \\| Project \\| OpenProject](https://host/wp/42)');
  assert.equal(await copy({ id: 1 }), true);
  assert.equal(writes.at(-1), '[42](https://host/wp/42)');
  mode = COPY_MODES.SHORT_TITLE;
  assert.equal(await copy({ id: 1 }), true);
  assert.equal(writes.at(-1), '[Task \\(42\\)](https://host/wp/42)');
});

test('a delayed setting read preserves invocation order with an explicit menu action', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const writes = [];
  const copy = createCopyAction({}, {
    toolbarMode: async () => { await pending; return COPY_MODES.WORK_PACKAGE_ID; },
    pageInfo: async () => ({ title: 'Task (42)', url: 'https://host/wp/42', isOpenProject: true }),
    clipboard: { writeText: async (text) => writes.push(text) }, feedback: { show: async () => {} },
  });
  const first = copy({ id: 1 }), second = copy({ id: 1 }, COPY_MODES.TITLE);
  await new Promise(setImmediate);
  assert.deepEqual(writes, []);
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(writes, ['[42](https://host/wp/42)', '[Task \\(42\\)](https://host/wp/42)']);
});

test('storage read failure leaves the clipboard unchanged and explicit menu actions still work', async () => {
  const writes = [];
  const copy = createCopyAction({}, {
    toolbarMode: async () => { throw new Error('Storage unavailable'); },
    pageInfo: async () => ({ title: 'Task', url: 'https://host/' }),
    clipboard: { writeText: async (text) => writes.push(text) }, feedback: { show: async () => {} },
  });
  assert.equal(await copy({ id: 1 }), false);
  assert.deepEqual(writes, []);
  assert.equal(await copy({ id: 1 }, COPY_MODES.TITLE), true);
  assert.deepEqual(writes, ['[Task](https://host/)']);
});
