import { createClient } from "@supabase/supabase-js";
import {
  createSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifyPassword,
} from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!username || !password) {
    return Response.json({ error: "Username and password required" }, { status: 400 });
  }

  // Case-insensitive username match
  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, role, password")
    .ilike("username", username)
    .single();

  if (error || !user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Verify the submitted password against the stored value. verifyPassword()
  // transparently handles both bcrypt hashes (the new normal) and legacy
  // plain-text rows from before this migration.
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }


  const token = await createSession(user.id);
  console.log("[login] createSession result:", token ? "OK" : "FAILED", "userId:", user.id);
  if (!token) {
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Set token as HTTP-only cookie. JavaScript on the client cannot read this,
  // which neutralizes XSS-based token theft. The browser sends it automatically
  // on every same-site request, so client fetches don't need to thread a header.
  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    isProd ? "Secure" : "",
  ].filter(Boolean).join("; ");

  return new Response(
    JSON.stringify({
      success: true,
      user: { id: String(user.id), username: user.username, role: user.role },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
      },
    }
  );
}
