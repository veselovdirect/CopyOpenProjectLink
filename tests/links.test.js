import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkPackageUrl } from '../extension/src/work-package-url-resolver.js';
import { isOpenProject, OPENPROJECT_SELECTORS } from '../extension/src/openproject-detector.js';
import { escapeMarkdownTitle, formatMarkdownLink } from '../extension/src/markdown-formatter.js';
import { buildPageLink } from '../extension/src/link-builder.js';

const examples = [
  ['/projects/OP/work_packages/OP-20237/activity', 'OP-20237'],
  ...['activity', 'files', 'relations', '', 'wikis', 'github', 'gitlab', 'watchers']
    .map((view) => [`/notifications/details/OP-20237${view ? `/${view}` : ''}?facet=all`, 'OP-20237']),
  ['/projects/AGILE/work_packages/AGILE-22/activity', 'AGILE-22'],
  ['/notifications/details/112554', '112554'],
  ['/projects/riedaktor/work_packages/112554/activity', '112554'],
  ['/projects/riedaktor/work_packages/112554/relations', '112554'],
  ['/work_packages/112554', '112554'],
  ['/work_packages/OP-20237/activity?x=1#comment-2', 'OP-20237'],
];
for (const [input, id] of examples) {
  test(`normalize ${input}`, () => {
    for (const origin of ['https://community.openproject.org', 'https://openproject.example.org', 'http://intranet:8080']) {
      assert.equal(resolveWorkPackageUrl(origin + input, true), `${origin}/work_packages/${id}`);
      assert.equal(resolveWorkPackageUrl(origin + input, false), origin + input);
    }
  });
}
test('preserve installation prefix and project names with escaped characters', () => {
  assert.equal(resolveWorkPackageUrl('https://host/op/projects/my%20project/work_packages/7/activity?a#b', true), 'https://host/op/work_packages/7');
  assert.equal(resolveWorkPackageUrl('https://host/op/notifications/details/TEAM-X-7/files', true), 'https://host/op/work_packages/TEAM-X-7');
});
for (const input of [
  'https://host/projects/OP/work_packages?query=12#list', 'https://host/projects/OP/overview?x=1#y',
  'https://host/notifications?facet=all', 'https://host/work_packages/123abc/activity',
  'https://host/work_packages/OP-20237evil', 'https://host/work_packages/-2',
  'https://host/work_packages/new', 'https://host/notifications/details/',
  'https://host/work_packages/123%2F456', 'not a URL', 'file:///work_packages/2',
]) {
  test(`preserve unresolved ${input}`, () => assert.equal(resolveWorkPackageUrl(input, true), input));
}
test('recognize only the head meta marker, on any domain', () => {
  const queries = [];
  const document = { head: { querySelector: (selector) => { queries.push(selector); return {}; } } };
  assert.equal(isOpenProject(document), true);
  assert.deepEqual(queries, OPENPROJECT_SELECTORS);
  assert.equal(isOpenProject({ head: { querySelector: () => null } }), false);
  assert.equal(isOpenProject({}), false);
  assert.equal(isOpenProject(document, ['meta[name="custom"]']), true);
});
test('escape title punctuation, HTML and entity-like content', () => {
  assert.equal(escapeMarkdownTitle('A [B] \\ *C* _D_ `x`'), 'A \\[B\\] \\\\ \\*C\\* \\_D\\_ \\`x\\`');
  assert.equal(escapeMarkdownTitle('<b>&amp;</b>'), '&lt;b&gt;&amp;amp;&lt;/b&gt;');
  assert.equal(escapeMarkdownTitle('First\nSecond\r\nThird\tEnd'), 'First Second Third End');
});
test('encode Markdown destination delimiters while preserving query/hash', () => {
  assert.equal(formatMarkdownLink('Title', 'https://example.org/a(b)?q=one%20two#part'), '[Title](https://example.org/a%28b%29?q=one%20two#part)');
});
test('normal page keeps exact URL and current title', () => {
  assert.equal(buildPageLink({ title: 'Chrome Extensions | Chrome for Developers', url: 'https://developer.chrome.com/docs/extensions/?a=1#b', isOpenProject: false }), '[Chrome Extensions \\| Chrome for Developers](https://developer.chrome.com/docs/extensions/?a=1#b)');
});
test('OpenProject title never becomes an ID; empty title remains empty', () => {
  assert.equal(buildPageLink({ title: 'Some task title', url: 'https://host/projects/p/work_packages/OP-42/activity', isOpenProject: true }), '[Some task title](https://host/work_packages/OP-42)');
  assert.equal(buildPageLink({ title: '', url: 'https://host/', isOpenProject: false }), '[](https://host/)');
});
