import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopyAction } from '../extension/src/extension-actions.js';
import { createClipboardService } from '../extension/src/clipboard-service.js';
import { getPageInfo } from '../extension/src/page-info-provider.js';
import { COPY_MODES } from '../extension/src/link-builder.js';
import { ID_NOT_FOUND } from '../extension/src/work-package-id.js';

test('copy uses the supplied tab, not a subsequent active-tab lookup', async () => {
  const reads = [], writes = [], states = [];
  const copy = createCopyAction({}, {
    pageInfo: async (id) => { reads.push(id); return { title: `Tab ${id}`, url: `https://host/${id}`, isOpenProject: false }; },
    clipboard: { writeText: async (text) => writes.push(text) },
    feedback: { show: async (tabId, success) => states.push([tabId, success]) },
  });
  assert.deepEqual(await Promise.all([copy({ id: 1 }), copy({ id: 2 })]), [true, true]);
  assert.deepEqual(reads, [1, 2]);
  assert.deepEqual(writes, ['[Tab 1](https://host/1)', '[Tab 2](https://host/2)']);
  assert.deepEqual(states, [[1, true], [2, true]]);
});
test('restricted page and denied clipboard produce error feedback and recover', async () => {
  const states = [], writes = [];
  const copy = createCopyAction({}, {
    pageInfo: async (id) => { if (id === 1) throw new Error('Restricted'); return { title: 'T', url: 'https://host/', isOpenProject: false }; },
    clipboard: { writeText: async (text) => { writes.push(text); if (writes.length === 1) throw new Error('Denied'); } },
    feedback: { show: async (tabId, success) => states.push([tabId, success]) },
  });
  assert.equal(await copy({ id: 1 }), false);
  assert.equal(await copy({ id: 2 }), false);
  assert.equal(await copy({ id: 3 }), true);
  assert.deepEqual(states, [[1, false], [2, false], [3, true]]);
  assert.equal(await copy(undefined), false);
});
test('copy completion follows invocation order even when the second read finishes first', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const writes = [];
  const copy = createCopyAction({}, {
    pageInfo: async (id) => { if (id === 1) await pending; return { title: String(id), url: `https://host/${id}` }; },
    clipboard: { writeText: async (text) => writes.push(text) },
    feedback: { show: async () => {} },
  });
  const first = copy({ id: 1 }), second = copy({ id: 2 });
  release();
  await Promise.all([first, second]);
  assert.deepEqual(writes, ['[1](https://host/1)', '[2](https://host/2)']);
});
test('page provider reads the top-level document in an isolated world', async () => {
  let options;
  const page = { title: 'Current', url: 'https://host/', isOpenProject: true };
  const api = { scripting: { executeScript: async (value) => { options = value; return [{ frameId: 0, result: page }]; } } };
  assert.deepEqual(await getPageInfo(7, api), page);
  assert.deepEqual(options.target, { tabId: 7, frameIds: [0] });
  assert.equal(options.world, 'ISOLATED');
  await assert.rejects(getPageInfo(7, { scripting: { executeScript: async () => [] } }), /PAGE_UNAVAILABLE/);
});
test('clipboard serializes creation, acknowledgement and teardown; failed write recovers', async () => {
  const events = [];
  let open = false, fail = true;
  const service = createClipboardService({
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      getContexts: async () => open ? [{}] : [],
      sendMessage: async (message) => { events.push(message.text); const ok = !fail; fail = false; return { ok }; },
    },
    offscreen: {
      createDocument: async () => { assert.equal(open, false); open = true; events.push('open'); },
      closeDocument: async () => { open = false; events.push('close'); },
    },
  });
  const results = await Promise.allSettled([service.writeText('first'), service.writeText('second')]);
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'fulfilled']);
  assert.deepEqual(events, ['open', 'first', 'close', 'open', 'second', 'close']);
});

test('use worker clipboard when the browser exposes the modern API', async () => {
  const writes = [];
  const service = createClipboardService({}, { writeText: async (text) => writes.push(text) });
  await service.writeText('modern clipboard');
  assert.deepEqual(writes, ['modern clipboard']);
});

test('ID failure leaves clipboard unchanged, explains why, and does not change toolbar mode', async () => {
  const writes = [], states = [];
  const copy = createCopyAction({}, {
    pageInfo: async () => ({ title: 'Task without an ID', url: 'https://host/work_packages/7/activity', isOpenProject: true }),
    clipboard: { writeText: async (text) => writes.push(text) },
    feedback: { show: async (...state) => states.push(state) },
  });
  assert.equal(await copy({ id: 1 }, COPY_MODES.WORK_PACKAGE_ID), false);
  assert.deepEqual(writes, []);
  assert.deepEqual(states, [[1, false, ID_NOT_FOUND]]);
  assert.equal(await copy({ id: 1 }), true);
  assert.deepEqual(writes, ['[Task without an ID](https://host/wp/7)']);
});
