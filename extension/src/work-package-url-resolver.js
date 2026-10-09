const ID = '(?:[0-9]+|[A-Za-z][A-Za-z0-9_-]*-[0-9]+)';

// The captured base also supports OpenProject installations under a subpath.
export const WORK_PACKAGE_ROUTES = Object.freeze([
  new RegExp(`^(.*?)(?:/projects/[^/]+)?/work_packages/(${ID})(?:/|$)`),
  new RegExp(`^(.*?)/notifications/details/(${ID})(?:/|$)`),
]);

export function resolveWorkPackageUrl(originalUrl, isOpenProject, routes = WORK_PACKAGE_ROUTES) {
  if (!isOpenProject) return originalUrl;
  let url;
  try {
    url = new URL(originalUrl);
  } catch {
    return originalUrl;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return originalUrl;
  for (const route of routes) {
    const match = url.pathname.match(route);
    if (match) {
      // Keep scheme, server, port and installation prefix; drop view/query/hash.
      url.pathname = `${match[1]}/work_packages/${match[2]}`;
      url.search = '';
      url.hash = '';
      return url.href;
    }
  }
  return originalUrl;
}
