import { createClient } from "@supabase/supabase-js";
import { validateToken } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export async function GET(request: Request) {
  const caller = await validateToken(request);
  if (!caller || !ADMIN_ROLES.has(caller.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("users")
    .select("id, username, role, created_at")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ users: data });
}

/**
 * POST /api/crm/users — create a new CRM user.
 *
 * Auth: caller must be admin or super_admin (validated via session cookie).
 * The plain-text password sent in the request body is hashed on the server
 * with bcrypt before being written to the database. The browser never knows
 * the hash exists, and the database never sees the plaintext.
 */
export async function POST(request: Request) {
  const caller = await validateToken(request);
  if (!caller || !ADMIN_ROLES.has(caller.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "");

  if (!username || !password || !role) {
    return Response.json({ error: "username, password and role are required" }, { status: 400 });
  }
  if (!["super_admin", "admin", "teacher"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ username, password, role })
    .select("id, username, role, created_at")
    .single();

  if (error) {
    const isDup = error.message.toLowerCase().includes("duplicate");
    return Response.json(
      { error: isDup ? "Username already exists" : error.message },
      { status: isDup ? 409 : 500 }
    );
  }

  return Response.json({ user: data });
}
