import { createClient } from "@supabase/supabase-js";
import { validateToken } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/crm/users/[id] — update an existing CRM user.
 *
 * Auth: admin / super_admin or updating own user account.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const caller = await validateToken(request);
  if (!caller) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const isSelf = caller.id === id;
  if (!isSelf && !ADMIN_ROLES.has(caller.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updates: Record<string, string | boolean | null> = {};
  if (typeof body.username === "string") updates.username = body.username.trim();
  if (typeof body.role === "string") {
    if (!["super_admin", "admin", "teacher"].includes(body.role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }
    // Only admins/super_admins can change roles
    if (!ADMIN_ROLES.has(caller.role)) {
      return Response.json({ error: "Forbidden to change role" }, { status: 403 });
    }
    updates.role = body.role;
  }
  if ("email" in body) updates.email = body.email ? String(body.email).trim() : null;
  if ("can_take_appointments" in body) {
    // Only admins/super_admins can change appointments config
    if (!ADMIN_ROLES.has(caller.role)) {
      return Response.json({ error: "Forbidden to change appointment configuration" }, { status: 403 });
    }
    updates.can_take_appointments = !!body.can_take_appointments;
  }

  // Only update password if a non-empty value was provided.
  if (typeof body.password === "string" && body.password.trim()) {
    updates.password = body.password.trim();
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, username, role, email, can_take_appointments, created_at")
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

/**
 * DELETE /api/crm/users/[id] — remove a CRM user.
 * Auth: admin / super_admin only.
 */
export async function DELETE(request: Request, ctx: RouteCtx) {
  const caller = await validateToken(request);
  if (!caller || !ADMIN_ROLES.has(caller.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  // Don't let an admin delete themselves and lock everyone out.
  if (id === caller.id) {
    return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
