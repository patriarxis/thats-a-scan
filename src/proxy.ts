import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROOT_FILES = new Set([
  "favicon.svg",
  "og-image.svg",
  "site.webmanifest",
]);

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
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  return PUBLIC_ROOT_FILES.has(parts[0]!);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/.well-known/") || isPublicRootAsset(pathname)) {
    return NextResponse.next();
  }

  const normalized = normalizePathname(pathname);

  if (normalized === "/en" || normalized.startsWith("/en/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = normalized === "/en" ? "/" : normalized.replace(/^\/en/, "") || "/";
    redirectUrl.search = search;
    return NextResponse.redirect(redirectUrl);
  }
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
