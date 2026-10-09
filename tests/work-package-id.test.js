import test from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkPackageId, ID_NOT_FOUND } from '../extension/src/work-package-id.js';
import { buildPageLink, COPY_MODES } from '../extension/src/link-builder.js';

for (const [title, expected] of [
  ['Update docs (112554) - OpenProject', '112554'],
  ['Update docs (OP-20237) - OpenProject', 'OP-20237'],
  ['Task (#112554)', '#112554'],
  ['Task (#OP-42)', '#OP-42'],
  ['Task ( # TEAM-X-7 ) - OpenProject', '#TEAM-X-7'],
  ['Ошибка: Не работает состояние с условием "не определено" (#112903) | VisualEditor | OpenProject', '#112903'],
  ['Plan (2026) (draft) (OP-42) - OpenProject', 'OP-42'],
  ['Task (112554)', '112554'],
  ['Task', null], ['Task (draft)', null], ['Task (112554 extra)', null],
  ['Task (112554abc)', null], ['Task (OP-42broken)', null], ['Task (112554', null],
]) {
  test(`extract work package ID from ${title}`, () => assert.equal(extractWorkPackageId(title), expected));
}

test('ID mode changes link text only and keeps title mode as the default', () => {
  const page = { title: 'Update docs (112554)', url: 'https://host/notifications/details/112554/files?x=1#part', isOpenProject: true };
  assert.equal(buildPageLink(page, COPY_MODES.WORK_PACKAGE_ID), '[112554](https://host/work_packages/112554)');
  assert.equal(buildPageLink(page), '[Update docs \\(112554\\)](https://host/work_packages/112554)');
});

test('ID mode uses the title marker and never substitutes an ID from the URL', () => {
  const page = { title: 'Task (OP-42)', url: 'https://host/work_packages/999/activity', isOpenProject: true };
  assert.equal(buildPageLink(page, COPY_MODES.WORK_PACKAGE_ID), '[OP\\-42](https://host/work_packages/999)');
  assert.throws(() => buildPageLink({ ...page, title: 'Task without marker' }, COPY_MODES.WORK_PACKAGE_ID), { message: ID_NOT_FOUND });
});

test('ID mode rejects ordinary pages with parenthetical numbers', () => {
  assert.throws(() => buildPageLink({ title: 'Report (2026)', url: 'https://host/report', isOpenProject: false }, COPY_MODES.WORK_PACKAGE_ID), { message: ID_NOT_FOUND });
});

test('preserve # from the reported title in Markdown link text without adding it to the URL', () => {
  const page = {
    title: 'Ошибка: Не работает состояние с условием "не определено" (#112903) | VisualEditor | OpenProject',
    url: 'https://host/work_packages/112903/activity?facet=all#comment',
    isOpenProject: true,
  };
  assert.equal(buildPageLink(page, COPY_MODES.WORK_PACKAGE_ID), '[\\#112903](https://host/work_packages/112903)');
});
