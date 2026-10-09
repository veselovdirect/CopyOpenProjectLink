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
  response.end(`<!doctype html><head><title>${ordinary ? 'Ordinary [title]' : 'Task [title] - OpenProject'}</title>${ordinary ? '' : '<meta name="openproject_initializer">'}</head><body><a href="https://different.invalid/">Different destination</a><iframe src="/ordinary-frame"></iframe></body>`);
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
  const copy = async (url) => {
    await page.goto(url);
    await page.bringToFront();
    return worker.evaluate(async ({ url }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((tab) => tab.url === url);
      if (!tab) throw new Error('Fixture tab missing');
      // Native Event objects cannot be dispatched from JS; test the shared action pipeline.
      const success = await globalThis.testCopy(tab);
      return { success, badge: await chrome.action.getBadgeText({ tabId: tab.id }), popup: await chrome.action.getPopup({ tabId: tab.id }), title: await chrome.action.getTitle({ tabId: tab.id }) };
    }, { url });
  };
  const result = await copy(`${origin}/projects/demo/work_packages/OP-42/activity?x=1#comment`);
  console.log('OpenProject real clipboard result:', result);
  assert.equal(result.success, true);
  assert.equal(result.popup, '');
  assert.equal(result.badge, '');
  console.log('Browser:', await worker.evaluate(() => navigator.userAgent));
  // Clipboard verification uses a real paste action into a fixture textarea (no read permission).
  await page.evaluate(() => { const field = document.createElement('textarea'); field.id = 'paste'; document.body.append(field); });
  await page.locator('#paste').focus();
  await page.keyboard.press('Control+V');
  assert.equal(await page.locator('#paste').inputValue(), `[Task \\[title\\] \\- OpenProject](${origin}/work_packages/OP-42)`);
  const ordinaryUrl = `${origin}/ordinary?q=keep#fragment`;
  assert.equal((await copy(ordinaryUrl)).success, true);
  await page.evaluate(() => { const field = document.createElement('textarea'); field.id = 'paste'; document.body.append(field); });
  await page.locator('#paste').focus();
  await page.keyboard.press('Control+V');
  assert.equal(await page.locator('#paste').inputValue(), `[Ordinary \\[title\\]](${ordinaryUrl})`);
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
  console.log('Browser clipboard, normalized and ordinary URLs, no popup and restricted-page handling: OK');
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
