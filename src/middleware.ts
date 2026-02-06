import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isRouteGated } from "@/config/feature-flags";

const isPublicRoute = createRouteMatcher([
  "/",
  "/blog(.*)",
  "/changelog(.*)",
  "/feedback(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/trpc/mobileAuth(.*)",
  "/api/health(.*)",
  "/api/debug(.*)",
  "/api/cron(.*)",
  "/sitemap.xml",
  "/robots.txt",
]);

// Generate a unique request ID for correlation
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // Redirect gated routes to dashboard
  const pathname = request.nextUrl.pathname;
  if (isRouteGated(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Generate and attach request ID for observability
  const requestId = request.headers.get("x-request-id") || generateRequestId();

  // Create new headers with request ID for downstream handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Pass modified headers to downstream handlers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Also set on response headers for client-side correlation
  response.headers.set("x-request-id", requestId);

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and mobile auth routes (which use JWT, not Clerk)
    "/((?!_next|api/trpc/mobileAuth|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
