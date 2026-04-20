import { destroySession, readSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token) {
    await destroySession(token);
  }

  // Clear the cookie by setting Max-Age=0.
  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    isProd ? "Secure" : "",
  ].filter(Boolean).join("; ");

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
