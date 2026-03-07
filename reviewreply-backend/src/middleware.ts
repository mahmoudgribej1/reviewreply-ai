import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRODUCTION_HOST = "reviewreply-ai-hca9.vercel.app";

/**
 * Middleware to:
 * 1. Redirect any Vercel preview deployment URL to the production domain.
 *    This prevents OAuth redirect_uri_mismatch errors on preview builds.
 * 2. Add CORS headers for Chrome Extension requests.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // If this is a Vercel preview URL (not the production host, but still on vercel.app),
  // redirect to the same path on the production domain.
  if (
    host !== PRODUCTION_HOST &&
    host.endsWith(".vercel.app") &&
    !host.includes("localhost")
  ) {
    const url = request.nextUrl.clone();
    url.host = PRODUCTION_HOST;
    url.port = "";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308); // 308 = Permanent Redirect
  }

  // Only apply CORS to API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // For all other API requests, add CORS headers to the response
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return response;
}

export const config = {
  matcher: [
    // Match all routes for the preview → production redirect
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
