// Optional integration check. Run with COPY_LINK_PLAYWRIGHT set to a Playwright module
// and COPY_LINK_BROWSER set to an extension-capable Chromium executable.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  response.end(`<!doctype html><head><title>${title}</title>${ordinary ? '' : '<meta name="openproject_initializer">'}</head><body><a href="https://different.invalid/">Different destination</a><iframe src="/ordinary-frame"></iframe></body>`);
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
  const copy = async (url, mode) => {
    await page.goto(url);
    await page.bringToFront();
    return worker.evaluate(async ({ url, mode }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((tab) => tab.url === url);
      if (!tab) throw new Error('Fixture tab missing');
      // Native Event objects cannot be dispatched from JS; test the shared action pipeline.
      const success = await globalThis.testCopy(tab, mode);
      return { success, badge: await chrome.action.getBadgeText({ tabId: tab.id }), popup: await chrome.action.getPopup({ tabId: tab.id }), title: await chrome.action.getTitle({ tabId: tab.id }) };
    }, { url, mode });
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
  const ordinaryUrl = `${origin}/ordinary?q=keep#fragment`;
  assert.equal((await copy(ordinaryUrl)).success, true);
  const ordinaryText = `[Ordinary \\[title\\]](${ordinaryUrl})`;
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
  console.log('Browser clipboard, title/ID modes, unchanged toolbar default, missing-ID feedback, no popup and restricted pages: OK');
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
