import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHighlightLink, HIGHLIGHT_UNAVAILABLE } from '../extension/src/highlight-link.js';
import { getHighlightInfo, readHighlightInfo } from '../extension/src/highlight-info-provider.js';
import { createCopyAction } from '../extension/src/extension-actions.js';
import { COPY_MODES } from '../extension/src/link-builder.js';

const highlight = {
  text: 'Selected text', url: 'https://host/projects/demo/work_packages/42/activity?x=1#comment',
  fragment: { textStart: 'Selected text' },
};

test('highlight preserves the full OpenProject view, query and anchor', () => {
  assert.equal(buildHighlightLink(highlight), '[Selected text](https://host/projects/demo/work_packages/42/activity?x=1#comment:~:text=Selected%20text)');
  assert.equal(buildHighlightLink({ ...highlight, url: 'https://host/page' }), '[Selected text](https://host/page#:~:text=Selected%20text)');
});

test('replace old text directives without dropping a hash-based route', () => {
  assert.equal(buildHighlightLink({ ...highlight, url: 'https://host/#/page:~:text=old&text=other' }), '[Selected text](https://host/#/page:~:text=Selected%20text)');
});

test('encode Cyrillic and fragment delimiters and escape the Markdown label', () => {
  assert.equal(buildHighlightLink({
    text: 'Текст [A]\n(B)', url: 'https://host/',
    fragment: { prefix: 'a-,', textStart: 'Текст [A]', textEnd: '(B)', suffix: 'c&d' },
  }), '[Текст \\[A\\] \\(B\\)](https://host/#:~:text=a%2D%2C-,%D0%A2%D0%B5%D0%BA%D1%81%D1%82%20%5BA%5D,%28B%29,-c%26d)');
});

test('reject empty selections, missing selectors and non-web URLs', () => {
  for (const override of [{ text: ' \n ' }, { fragment: {} }, { url: 'file:///page' }, { url: 'javascript:alert(1)' }]) {
    assert.throws(() => buildHighlightLink({ ...highlight, ...override }), { message: HIGHLIGHT_UNAVAILABLE });
  }
});

test('highlight provider injects only local code into the isolated main frame', async () => {
  const calls = [];
  const api = { scripting: { executeScript: async (options) => {
    calls.push(options);
    return [{ frameId: 0, result: options.files ? undefined : highlight }];
  } } };
  assert.deepEqual(await getHighlightInfo(7, { selectionText: highlight.text }, api), highlight);
  assert.deepEqual(calls[0], { target: { tabId: 7, frameIds: [0] }, files: ['vendor/text-fragments.js'], world: 'ISOLATED' });
  assert.equal(calls[1].func, readHighlightInfo);
  assert.deepEqual(calls[1].args, [highlight.text]);
  assert.equal(calls[1].world, 'ISOLATED');
  for (const info of [undefined, { selectionText: '' }, { selectionText: 'text', editable: true }, { selectionText: 'text', frameId: 3 }]) {
    await assert.rejects(getHighlightInfo(7, info, api), { message: HIGHLIGHT_UNAVAILABLE });
  }
  assert.equal(calls.length, 2);
  await assert.rejects(getHighlightInfo(7, { selectionText: 'text' }, { scripting: { executeScript: async () => [] } }), { message: HIGHLIGHT_UNAVAILABLE });
});

test('highlight and page modes share clipboard ordering and recover after a failed selection', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const writes = [], states = [];
  const copy = createCopyAction({}, {
    pageInfo: async () => ({ title: 'Page', url: 'https://host/' }),
    highlightInfo: async (id, info) => {
      assert.equal(info.selectionText, highlight.text);
      if (id === 2) throw new Error(HIGHLIGHT_UNAVAILABLE);
      await pending;
      return highlight;
    },
    clipboard: { writeText: async (text) => writes.push(text) },
    feedback: { show: async (...state) => states.push(state) },
  });
  const first = copy({ id: 1 }, COPY_MODES.HIGHLIGHT, { selectionText: highlight.text });
  const second = copy({ id: 1 });
  await new Promise(setImmediate);
  assert.deepEqual(writes, []);
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(writes, [buildHighlightLink(highlight), '[Page](https://host/)']);
  assert.equal(await copy({ id: 2 }, COPY_MODES.HIGHLIGHT, { selectionText: highlight.text }), false);
  assert.equal(writes.length, 2);
  assert.deepEqual(states.at(-1), [2, false, HIGHLIGHT_UNAVAILABLE]);
  assert.equal(await copy({ id: 1 }), true);
});
