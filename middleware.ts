import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getLocaleFromPath(pathname: string): "el" | "en" {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "el";
}

function getPreferredLocale(request: NextRequest): "el" | "en" {
  const localeCookie = request.cookies.get("locale")?.value;
  if (localeCookie === "en" || localeCookie === "el") {
    return localeCookie;
  }

  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return acceptLanguage.includes("en") ? "en" : "el";
}

function shouldSkipRedirect(pathname: string): boolean {
  return pathname === "/en" || pathname.startsWith("/en/");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const localeFromPath = getLocaleFromPath(pathname);
  const preferredLocale = getPreferredLocale(request);

  if (!shouldSkipRedirect(pathname) && preferredLocale === "en") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
    redirectUrl.search = search;
    return NextResponse.redirect(redirectUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", localeFromPath);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
