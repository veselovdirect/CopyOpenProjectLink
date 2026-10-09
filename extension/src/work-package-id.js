export const WORK_PACKAGE_ID_PATTERN = '(?:[0-9]+|[A-Za-z][A-Za-z0-9_-]*-[0-9]+)';
export const ID_NOT_FOUND = 'WORK_PACKAGE_ID_NOT_FOUND';

export function extractWorkPackageId(title) {
  // The work package marker normally follows the task name. Ignore other
  // parenthetical text and prefer the last complete ID-shaped marker.
  const pattern = new RegExp(`\\(\\s*(#?)\\s*(${WORK_PACKAGE_ID_PATTERN})\\s*\\)`, 'g');
  const marker = Array.from(title.matchAll(pattern)).at(-1);
  // Keep the marker's optional # as part of the link text, outside URL handling.
  return marker ? `${marker[1]}${marker[2]}` : null;
}
