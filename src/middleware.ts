import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isRouteGated } from "@/config/feature-flags";

const PUBLIC_ROUTES = [
  /^\/$/,
  /^\/blog(\/.*)?$/,
  /^\/changelog(\/.*)?$/,
  /^\/feedback(\/.*)?$/,
  /^\/privacy(\/.*)?$/,
  /^\/terms(\/.*)?$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/forgot-password(\/.*)?$/,
  /^\/reset-password(\/.*)?$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/api\/trpc\/mobileAuth(\/.*)?$/,
  /^\/api\/health(\/.*)?$/,
  /^\/api\/debug(\/.*)?$/,
  /^\/api\/cron(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/sitemap\.xml$/,
  /^\/robots\.txt$/,
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pattern) => pattern.test(pathname));
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect gated routes to dashboard
  if (isRouteGated(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const session = getSessionCookie(request);

  // Redirect unauthenticated users away from protected routes
  if (!session && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (session && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Generate and attach request ID for observability
  const requestId = request.headers.get("x-request-id") || generateRequestId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and mobile auth routes (which use JWT)
    "/((?!_next|api/trpc/mobileAuth|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
