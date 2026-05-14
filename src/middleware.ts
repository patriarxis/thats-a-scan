import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Root-level files from `public/` (do not rewrite — let Next serve them). */
const PUBLIC_ROOT_FILES = new Set([
  "apple-touch-icon.png",
  "favicon-96x96.png",
  "favicon.ico",
  "favicon.svg",
  "meta-image.jpg",
  "site.webmanifest",
  "up-hellas-logo.svg",
  "up-hellas-mark.svg",
  "web-app-manifest-192x192.png",
  "web-app-manifest-512x512.png",
]);

function normalizePathname(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

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

/** Real App Router pages only — everything else is served the map shell (like Google Maps). */
function isValidAppPath(normalizedPathname: string): boolean {
  if (normalizedPathname === "/" || normalizedPathname === "") return true;
  if (normalizedPathname === "/en") return true;
  if (normalizedPathname.startsWith("/place/") && normalizedPathname.length > "/place/".length) {
    return true;
  }
  if (
    normalizedPathname.startsWith("/en/place/") &&
    normalizedPathname.length > "/en/place/".length
  ) {
    return true;
  }
  return false;
}

function isPublicRootAsset(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  return PUBLIC_ROOT_FILES.has(parts[0]!);
}

function withLocaleHeaders(request: NextRequest, pathnameForLocale: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", getLocaleFromPath(pathnameForLocale));
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function rewriteUnknownToMapShell(request: NextRequest, normalizedPathname: string, search: string) {
  const preferredLocale = getPreferredLocale(request);
  const underEnglishPath =
    normalizedPathname === "/en" || normalizedPathname.startsWith("/en/");

  const useEnglishMap = underEnglishPath || preferredLocale === "en";
  const targetPath = useEnglishMap ? "/en" : "/";

  const rewriteUrl = new URL(targetPath + search, request.url);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", useEnglishMap ? "en" : "el");

  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/.well-known/")) {
    return withLocaleHeaders(request, pathname);
  }

  if (isPublicRootAsset(pathname)) {
    return withLocaleHeaders(request, pathname);
  }

  const normalized = normalizePathname(pathname);

  if (!isValidAppPath(normalized)) {
    return rewriteUnknownToMapShell(request, normalized, search);
  }

  const preferredLocale = getPreferredLocale(request);

  if (!shouldSkipRedirect(normalized) && preferredLocale === "en") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = normalized === "/" ? "/en" : `/en${normalized}`;
    redirectUrl.search = search;
    return NextResponse.redirect(redirectUrl);
  }

  return withLocaleHeaders(request, pathname);
}

/** With `src/`, middleware must live next to `app/` (see Next.js docs). Root `middleware.ts` is ignored. */
export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).+)",
  ],
};
