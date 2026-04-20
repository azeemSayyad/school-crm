import { createClient } from "@supabase/supabase-js";

export const SESSION_COOKIE = "gmtti_session";
export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Verify a plain-text password against a stored plain-text value.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  return plain === stored;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function generateToken(): string {
  // Use Web Crypto for cryptographically strong randomness (Edge + Node runtimes).
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  // Base64url-style without padding — URL/cookie safe.
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Read the session token from a Request's Cookie header.
 * Falls back to legacy `Authorization: Bearer` for in-flight requests during the cutover.
 */
export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
    }
  }
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * Validate a session token from the request cookie.
 * Returns the user if valid, null if not.
 */
export async function validateToken(request: Request): Promise<{ id: string; username: string; role: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const token = readSessionToken(request);
  if (!token) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, username, role, token_expires_at")
    .eq("session_token", token)
    .single();

  if (error || !data) return null;

  // Check expiry
  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
    // Token expired — clear it
    await supabase.from("users").update({ session_token: null, token_expires_at: null }).eq("id", data.id);
    return null;
  }

  return { id: String(data.id), username: data.username, role: data.role };
}

/**
 * Create a session token for a user. Returns the token.
 */
export async function createSession(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabase
    .from("users")
    .update({ session_token: token, token_expires_at: expiresAt })
    .eq("id", userId);

  if (error) {
    console.error("[createSession] Supabase error:", error.message, error.code, error.details);
    return null;
  }
  return token;
}

/**
 * Destroy a session token.
 */
export async function destroySession(token: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from("users")
    .update({ session_token: null, token_expires_at: null })
    .eq("session_token", token);
}
