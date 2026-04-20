import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "gmtti_session";

/**
 * Edge middleware: gate the /crm/* surface area.
 *
 * We only check for the *presence* of the session cookie here — not its validity —
 * because validating against Supabase from the Edge runtime would add latency to
 * every request. The actual cryptographic check happens server-side inside API
 * routes via validateToken(), and individual pages re-verify on mount via
 * /api/auth/verify. Middleware is just a fast first-line redirect for the
 * unauthenticated case.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) return NextResponse.next();

  // No session — bounce to the landing page (which renders the login screen).
  const loginUrl = new URL("/", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/crm/:path*"],
};
