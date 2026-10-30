import test from 'node:test';
import assert from 'node:assert/strict';
import { shortenWorkPackageTitle } from '../extension/src/work-package-title.js';
import { buildPageLink, COPY_MODES } from '../extension/src/link-builder.js';
import { ID_NOT_FOUND } from '../extension/src/work-package-id.js';

const title = 'Bug: “Filter by text” returns unrelated work packages for Cyrillic queries (OP-20237) | OpenProject | OpenProject Community';

test('short title mode produces the requested Markdown link', () => {
  assert.equal(buildPageLink({ title, url: 'https://community.openproject.org/projects/demo/work_packages/OP-20237/activity?x=1#comment', isOpenProject: true }, COPY_MODES.SHORT_TITLE),
    '[“Filter by text” returns unrelated work packages for Cyrillic queries \\(OP\\-20237\\)](https://community.openproject.org/wp/OP-20237)');
});

for (const [input, expected] of [
  ['Ошибка: Текст: подробности (#112903) | VisualEditor | OpenProject', 'Текст: подробности (#112903)'],
  ['Bug: A | B (OP-42) | Project | OpenProject', 'A | B (OP-42)'],
  ['Task (42) | Project: demo | OpenProject', 'Task (42)'],
  ['Bug: Task (42)', 'Task (42)'],
  ['Task (42)', 'Task (42)'],
  ['Bug: Task (42) | OpenProject', 'Task (42) | OpenProject'],
  ['  Bug:   Task (42)   | Project | OpenProject  ', 'Task (42)'],
]) {
  test(`shorten ${input}`, () => assert.equal(shortenWorkPackageTitle(input), expected));
}

test('short title mode rejects ordinary pages and titles without a task ID', () => {
  for (const page of [
    { title, isOpenProject: false },
    { title: 'Overview | Project | OpenProject', isOpenProject: true },
  ]) {
    assert.throws(() => buildPageLink({ ...page, url: 'https://host/' }, COPY_MODES.SHORT_TITLE), { message: ID_NOT_FOUND });
  }
});

test('shortening precedes Markdown escaping and preserves the URL installation prefix', () => {
  const page = { title: 'Bug: [A] & <B> (#42) | Project | OpenProject', url: 'https://host/op/notifications/details/42/activity', isOpenProject: true };
  assert.equal(buildPageLink(page, COPY_MODES.SHORT_TITLE), '[\\[A\\] &amp; &lt;B&gt; \\(\\#42\\)](https://host/op/wp/42)');
  assert.equal(buildPageLink(page), '[Bug: \\[A\\] &amp; &lt;B&gt; \\(\\#42\\) \\| Project \\| OpenProject](https://host/op/wp/42)');
});
