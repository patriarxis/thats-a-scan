import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Any single-segment root path carrying a file extension is a static asset in
 * `public/`. Matching on shape rather than an allowlist means new files added to
 * `public/` cannot silently start serving the app's HTML.
 */
const PUBLIC_ROOT_ASSET = /^\/[^/]+\.[a-z0-9]+$/i;

function normalizePathname(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isValidAppPath(normalizedPathname: string): boolean {
  if (normalizedPathname === "/" || normalizedPathname === "") return true;
  if (normalizedPathname.startsWith("/texture/") && normalizedPathname.length > "/texture/".length) {
    return true;
  }
  if (normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/")) {
    return true;
  }
  return false;
}

function isPublicRootAsset(pathname: string): boolean {
  return PUBLIC_ROOT_ASSET.test(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/.well-known/") || isPublicRootAsset(pathname)) {
    return NextResponse.next();
  }

  const normalized = normalizePathname(pathname);

  if (!isValidAppPath(normalized)) {
    const rewriteUrl = new URL("/" + search, request.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|textures|media).+)",
  ],
};
