// Optional integration check. Run with COPY_LINK_PLAYWRIGHT set to a Playwright module
// and COPY_LINK_BROWSER set to an extension-capable Chromium executable.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.COPY_LINK_PLAYWRIGHT || 'playwright');
const extension = fileURLToPath(new URL('../extension/', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'copy-link-smoke-'));
const testExtension = join(profile, 'extension');
await cp(extension, testExtension, { recursive: true });
const manifestPath = join(testExtension, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
// Automation cannot grant activeTab through a physical toolbar gesture. Grant only
// the local fixture host and tab metadata in this temporary test copy.
manifest.permissions.push('tabs');
manifest.host_permissions = ['http://127.0.0.1/*'];
// Expose only the shared handler in the temporary test copy, never in the shipped build.
await writeFile(join(testExtension, 'src/background.js'),
  (await readFile(join(testExtension, 'src/background.js'), 'utf8')) + '\nglobalThis.testCopy = copyPage;\n');
await writeFile(manifestPath, JSON.stringify(manifest));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  const ordinary = request.url.startsWith('/ordinary');
  const title = request.url.includes('/112903')
    ? 'Ошибка: Не работает состояние с условием "не определено" (#112903) | VisualEditor | OpenProject'
    : ordinary ? 'Ordinary [title]' : request.url.startsWith('/missing')
    ? 'Task without an ID - OpenProject' : request.url.includes('/112554')
    ? 'Task (112554) - OpenProject' : 'Task [title] (OP-42) - OpenProject';
  const content = `
    <p>First context before <span id="first">Repeated target phrase</span> with a first ending.</p>
    <div style="height:1600px"></div>
    <p>Second context before <span id="second">Repeated target phrase</span> with a second ending.</p>
    <p id="cyrillic">Выделенный текст [пример] — проверка ссылки.</p>
    <div id="multiple"><p>Opening words in the first paragraph.</p><p>Closing words in the second paragraph.</p></div>
    <div style="height:0"><div style="float:left;width:100%"><dl><dd>4.1. <strong id="overflow-target">Альтернативный способ задания функций</strong></dd></dl><p>Возможна автоматическая генерация</p></div></div><div style="clear:both"></div>
    <div style="display:none">Альтернативный способ задания функций</div>
    <div id="feed-first"><a>Дмитрий Веселов</a>
            отправил(а) изменения в <a>master</a> в <a>redkit-lab/visualeditor</a></div>
    <div><a>Дмитрий Веселов</a>
            отправил(а) изменения в <a>master</a> в <a>redkit-lab/scada</a></div>
    <p id="editable" contenteditable="true">Editable text cannot be linked.</p>
    <div style="height:1200px"></div>`;
  response.end(`<!doctype html><head><title>${title}</title>${ordinary ? '' : '<meta name="openproject_initializer">'}</head><body><a href="https://different.invalid/">Different destination</a>${request.url.startsWith('/ordinary-frame') ? '' : '<iframe src="/ordinary-frame"></iframe>'}${content}</body>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.COPY_LINK_BROWSER || undefined,
    args: [`--disable-extensions-except=${testExtension}`, `--load-extension=${testExtension}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const errors = [];
  worker.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await context.newPage();
  const invoke = async (mode, info) => {
    await page.bringToFront();
    return worker.evaluate(async ({ url, mode, info }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((tab) => tab.url === url);
      if (!tab) throw new Error('Fixture tab missing');
      // Native Event objects cannot be dispatched from JS; test the shared action pipeline.
      const success = await globalThis.testCopy(tab, mode, info);
      return { success, badge: await chrome.action.getBadgeText({ tabId: tab.id }), popup: await chrome.action.getPopup({ tabId: tab.id }), title: await chrome.action.getTitle({ tabId: tab.id }) };
    }, { url: page.url(), mode, info });
  };
  const copy = async (url, mode) => {
    await page.goto(url);
    return invoke(mode);
  };
  const paste = async () => {
    await page.evaluate(() => {
      const field = document.getElementById('paste') || document.createElement('textarea');
      field.id = 'paste'; field.value = ''; document.body.append(field);
    });
    await page.locator('#paste').focus();
    await page.keyboard.press('Control+V');
    return page.locator('#paste').inputValue();
  };
  const result = await copy(`${origin}/projects/demo/work_packages/OP-42/activity?x=1#comment`);
  console.log('OpenProject real clipboard result:', result);
  assert.equal(result.success, true);
  assert.equal(result.popup, '');
  assert.equal(result.badge, '');
  console.log('Browser:', await worker.evaluate(() => navigator.userAgent));
  // Clipboard verification uses a real paste action into a fixture textarea (no read permission).
  assert.equal(await paste(), `[Task \\[title\\] \\(OP\\-42\\) \\- OpenProject](${origin}/wp/OP-42)`);
  const taskUrl = `${origin}/projects/demo/work_packages/OP-42/relations?x=1#comment`;
  assert.equal((await copy(taskUrl, 'work-package-id')).success, true);
  assert.equal(await paste(), `[OP\\-42](${origin}/wp/OP-42)`);
  // A prior ID choice must not change the default toolbar action.
  assert.equal((await copy(taskUrl)).success, true);
  assert.equal(await paste(), `[Task \\[title\\] \\(OP\\-42\\) \\- OpenProject](${origin}/wp/OP-42)`);
  assert.equal((await copy(`${origin}/notifications/details/112554/files?facet=all`, 'work-package-id')).success, true);
  assert.equal(await paste(), `[112554](${origin}/wp/112554)`);
  assert.equal((await copy(`${origin}/work_packages/112903/activity?facet=all#comment`, 'work-package-id')).success, true);
  assert.equal(await paste(), `[\\#112903](${origin}/wp/112903)`);
  assert.equal((await invoke('short-title')).success, true);
  assert.equal(await paste(), `[Не работает состояние с условием "не определено" \\(\\#112903\\)](${origin}/wp/112903)`);
  assert.equal((await invoke()).success, true);
  assert.equal(await paste(), `[Ошибка: Не работает состояние с условием "не определено" \\(\\#112903\\) \\| VisualEditor \\| OpenProject](${origin}/wp/112903)`);
  const options = await context.newPage();
  await options.goto(await worker.evaluate(() => chrome.runtime.getURL('options.html')));
  await options.waitForFunction(() => !document.getElementById('toolbar-modes').disabled);
  assert.equal(await options.locator('input[value="title"]').isChecked(), true);
  for (const mode of ['work-package-id', 'short-title', 'title']) {
    await options.locator(`input[value="${mode}"]`).check();
    await options.waitForFunction(() => document.getElementById('status').textContent === 'Saved.');
    await options.reload();
    await options.waitForFunction(() => !document.getElementById('toolbar-modes').disabled);
    assert.equal(await options.locator(`input[value="${mode}"]`).isChecked(), true);
    assert.equal((await invoke()).success, true);
    const expected = mode === 'work-package-id' ? '\\#112903'
      : mode === 'short-title' ? 'Не работает состояние с условием "не определено" \\(\\#112903\\)'
      : 'Ошибка: Не работает состояние с условием "не определено" \\(\\#112903\\) \\| VisualEditor \\| OpenProject';
    assert.equal(await paste(), `[${expected}](${origin}/wp/112903)`);
    // Explicit menu choices must not overwrite the preference.
    assert.equal((await invoke('work-package-id')).success, true);
    assert.equal(await worker.evaluate(() => chrome.storage.local.get('toolbarCopyMode')).then((value) => value.toolbarCopyMode), mode);
  }
  await options.evaluate(() => { chrome.storage.local.set = async () => { throw new Error('Test write failure'); }; });
  await options.locator('input[value="short-title"]').click();
  await options.waitForFunction(() => document.getElementById('status').textContent.includes('Could not save'));
  assert.equal(await options.locator('input[value="title"]').isChecked(), true);
  await options.reload();
  await options.waitForFunction(() => !document.getElementById('toolbar-modes').disabled);
  await options.setViewportSize({ width: 560, height: 650 });
  await mkdir(new URL('../.test-profile/', import.meta.url), { recursive: true });
  await options.screenshot({ path: fileURLToPath(new URL('../.test-profile/options.png', import.meta.url)), fullPage: true });
  await options.close();
  const highlightUrl = `${origin}/projects/demo/work_packages/OP-42/activity?highlight=1#section`;
  await page.goto(highlightUrl);
  const select = async (id) => page.evaluate((id) => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById(id));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  }, id);
  let selected = await select('second');
  assert.equal((await invoke('highlight', { selectionText: selected, frameId: 0 })).success, true);
  const repeatedLink = await paste();
  assert.ok(repeatedLink.startsWith(`[Repeated target phrase](${highlightUrl}:~:text=`));
  const targetUrl = repeatedLink.slice(repeatedLink.indexOf('](') + 2, -1);
  assert.match(targetUrl, /-,|,-/); // Repeated text needs disambiguating context.
  // Follow the copied link with a user gesture in a new top-level document.
  await page.evaluate((url) => {
    const link = document.createElement('a');
    link.id = 'follow-highlight'; link.href = url; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = 'Follow highlight'; document.body.prepend(link);
  }, targetUrl);
  const opened = context.waitForEvent('page');
  await page.locator('#follow-highlight').click();
  const destination = await opened;
  await destination.waitForLoadState();
  await destination.waitForFunction(() => {
    const rect = document.getElementById('second').getBoundingClientRect();
    return window.scrollY > 1000 && rect.top >= 0 && rect.top < innerHeight;
  });
  await destination.close();
  selected = await select('cyrillic');
  assert.equal((await invoke('highlight', { selectionText: selected })).success, true);
  const cyrillicLink = await paste();
  assert.ok(cyrillicLink.startsWith('[Выделенный текст \\[пример\\] — проверка ссылки\\.]('));
  assert.match(cyrillicLink, /%D0|%D1/);
  selected = await select('multiple');
  assert.equal((await invoke('highlight', { selectionText: selected })).success, true);
  const multiLink = await paste();
  assert.match(multiLink, /first paragraph.*Closing words/);
  assert.match(multiLink.split(':~:text=')[1], /,/); // A range across blocks, not one exact string.
  selected = await select('editable');
  assert.equal((await invoke('highlight', { selectionText: selected, editable: true })).success, false);
  assert.equal(await paste(), multiLink);
  selected = await select('second');
  assert.equal((await invoke('highlight', { selectionText: selected, frameId: 2 })).success, false);
  assert.equal(await paste(), multiLink);
  assert.equal((await invoke('highlight', { selectionText: 'A stale selection' })).success, false);
  assert.equal(await paste(), multiLink);
  const ordinaryUrl = `${origin}/ordinary?q=keep#fragment`;
  assert.equal((await copy(ordinaryUrl)).success, true);
  const ordinaryText = `[Ordinary \\[title\\]](${ordinaryUrl})`;
  assert.equal(await paste(), ordinaryText);
  const ordinaryShortTitle = await invoke('short-title');
  assert.equal(ordinaryShortTitle.success, false);
  assert.equal(await paste(), ordinaryText);
  const missing = await copy(`${origin}/missing`, 'work-package-id');
  assert.equal(missing.success, false);
  assert.equal(missing.badge, '!');
  assert.match(missing.title, /ID not found/);
  assert.equal(await paste(), ordinaryText);
  const ordinaryId = await copy(ordinaryUrl, 'work-package-id');
  assert.equal(ordinaryId.success, false);
  assert.equal(await paste(), ordinaryText);
  assert.deepEqual(await worker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })), []);
  let resetTitle;
  for (let attempt = 0; attempt < 16; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    resetTitle = await worker.evaluate(async () => {
      const tab = (await chrome.tabs.query({})).find((tab) => tab.url?.includes('/ordinary?'));
      return chrome.action.getTitle({ tabId: tab.id });
    });
    if (resetTitle === 'Copy OpenProject Link as Markdown') break;
  }
  assert.equal(resetTitle, 'Copy OpenProject Link as Markdown');
  await page.goto('edge://version');
  const denied = await worker.evaluate(async () => {
    const tab = (await chrome.tabs.query({})).find((tab) => /^(edge|chrome):\/\/version/.test(tab.url ?? ''));
    const success = await globalThis.testCopy(tab);
    return { success, badge: await chrome.action.getBadgeText({ tabId: tab.id }) };
  });
  assert.deepEqual(denied, { success: false, badge: '!' });
  assert.deepEqual(errors, []);
  await page.goto(ordinaryUrl);
  selected = await select('overflow-target');
  assert.equal((await invoke('highlight', { selectionText: selected })).success, true);
  const overflowLink = await paste();
  assert.ok(overflowLink.startsWith('[Альтернативный способ задания функций]('));
  assert.ok(overflowLink.includes(ordinaryUrl + ':~:text='));
  assert.ok(decodeURIComponent(overflowLink).includes('функций'));
  const overflowUrl = overflowLink.slice(overflowLink.indexOf('](') + 2, -1);
  await page.evaluate((url) => {
    const link = document.createElement('a');
    link.id = 'follow-overflow'; link.href = url; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = 'Follow overflowing text'; document.body.prepend(link);
  }, overflowUrl);
  const overflowOpened = context.waitForEvent('page');
  await page.locator('#follow-overflow').click();
  const overflowDestination = await overflowOpened;
  await overflowDestination.waitForLoadState();
  await overflowDestination.waitForFunction(() => {
    const rect = document.getElementById('overflow-target').getBoundingClientRect();
    return scrollY > 1000 && rect.top >= 0 && rect.top < innerHeight;
  });
  await overflowDestination.close();
  await page.bringToFront();
  selected = await page.evaluate(() => {
    const node = document.getElementById('feed-first').childNodes[1];
    const text = 'отправил(а) изменения';
    const start = node.textContent.indexOf(text);
    const range = document.createRange();
    range.setStart(node, start); range.setEnd(node, start + text.length);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    return selection.toString();
  });
  assert.equal((await invoke('highlight', { selectionText: selected })).success, true);
  const feedLink = await paste();
  const feedUrl = feedLink.slice(feedLink.indexOf('](') + 2, -1);
  assert.ok(decodeURIComponent(feedUrl).includes('отправил(а) изменения'));
  assert.match(feedUrl, /-,|,-/);
  await page.evaluate((url) => { document.getElementById('follow-overflow').href = url; }, feedUrl);
  const feedOpened = context.waitForEvent('page');
  await page.locator('#follow-overflow').click();
  const feedDestination = await feedOpened;
  await feedDestination.waitForLoadState();
  await feedDestination.waitForFunction(() => {
    const rect = document.getElementById('feed-first').getBoundingClientRect();
    return scrollY > 1000 && rect.top >= 0 && rect.top < innerHeight;
  });
  await feedDestination.close();
  console.log('Browser clipboard, title/ID/highlight modes, repeated-text navigation, Cyrillic, multi-paragraph selection, failure recovery, no popup and restricted pages: OK');
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
  assert.ok(basename(profile).startsWith('copy-link-smoke-'));
  await rm(profile, { recursive: true, force: true });
}
