import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  localizedPath,
  pathLocale,
  resolveLocale,
} from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathLocale(pathname)) return;

  const locale = resolveLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const url = request.nextUrl.clone();
  url.pathname = localizedPath(locale, pathname);
  // Temporary (307): the target depends on the visitor.
  return NextResponse.redirect(url);
}

export const config = {
  // Customer pages only: the API, Next.js internals, and files keep their URLs.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
