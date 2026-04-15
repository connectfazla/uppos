import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Edge middleware cannot rely on `process.env.NEXTAUTH_SECRET` the same way Node does
 * in Docker/standalone builds, which triggers NextAuth's `error=Configuration` redirect.
 * We only check for a session cookie here; layouts and API routes still validate JWT via
 * `getServerSession` / `getProfile` (requires NEXTAUTH_SECRET at Node runtime — set in .env).
 */
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.session-token",
] as const;

function hasSessionCookie(req: NextRequest) {
  return SESSION_COOKIE_NAMES.some((name) => !!req.cookies.get(name)?.value);
}

function isPublicPath(pathname: string) {
  if (pathname === "/login" || pathname === "/register" || pathname === "/") return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  // APIs enforce auth themselves (JSON 401/403); avoid redirecting XHR/fetch to HTML login.
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (hasSessionCookie(req)) return NextResponse.next();
  const login = new URL("/login", req.url);
  login.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
