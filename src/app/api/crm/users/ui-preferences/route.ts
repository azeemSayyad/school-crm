import { createClient } from "@supabase/supabase-js";
import { validateToken } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/crm/users/ui-preferences — return the current user's ui_preferences jsonb.
 */
export async function GET(request: Request) {
  const caller = await validateToken(request);
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("crm_users")
    .select("ui_preferences")
    .eq("id", caller.id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ preferences: data?.ui_preferences ?? {} });
}

/**
 * PATCH /api/crm/users/ui-preferences — merge { key, value } into ui_preferences.
 * Read-modify-write under the caller's id so users can only touch their own prefs.
 */
export async function PATCH(request: Request) {
  const caller = await validateToken(request);
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return Response.json({ error: "`key` is required" }, { status: 400 });
  if (!Object.prototype.hasOwnProperty.call(body, "value")) {
    return Response.json({ error: "`value` is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data: existing, error: readErr } = await supabase
    .from("crm_users")
    .select("ui_preferences")
    .eq("id", caller.id)
    .single();

  if (readErr) return Response.json({ error: readErr.message }, { status: 500 });

  const merged = { ...(existing?.ui_preferences ?? {}), [key]: body.value };

  const { error: writeErr } = await supabase
    .from("crm_users")
    .update({ ui_preferences: merged })
    .eq("id", caller.id);

  if (writeErr) return Response.json({ error: writeErr.message }, { status: 500 });

  return Response.json({ preferences: merged });
}
