function trimTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

// Whether a navigation link points at the page being shown. The home link
// (`/<lang>`) matches only itself, or it would be current on every page; any
// other link also matches its sub-pages.
export function isCurrentNavPath(pathname: string, href: string): boolean {
  const path = trimTrailingSlash(pathname);
  const target = trimTrailingSlash(href);
  if (path === target) {
    return true;
  }
  const isHome = /^\/[^/]+$/.test(target);
  return !isHome && path.startsWith(`${target}/`);
}
