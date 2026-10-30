export function shortenWorkPackageTitle(title) {
  const lastPipe = title.lastIndexOf('|');
  const suffixStart = lastPipe > 0 ? title.lastIndexOf('|', lastPipe - 1) : -1;
  const taskTitle = suffixStart >= 0 ? title.slice(0, suffixStart) : title;
  const colon = taskTitle.indexOf(':');
  return (colon >= 0 ? taskTitle.slice(colon + 1) : taskTitle).trim();
}
