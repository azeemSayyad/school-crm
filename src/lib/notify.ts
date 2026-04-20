import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Notify all admins about a new inbound email.
 */
export async function notifyNewEmail(senderName: string, senderEmail: string, subject: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: admins } = await supabase
    .from("crm_users")
    .select("id")
    .in("role", ["super_admin", "admin"]);

  if (!admins || admins.length === 0) return;

  const notifications = admins.map((admin: { id: number }) => ({
    type: "new_email",
    title: "New Email",
    message: `${senderName || senderEmail}: ${subject || "(No subject)"}`,
    user_id: admin.id,
  }));

  await supabase.from("notifications").insert(notifications);
}

/**
 * Notify all admins about a new lead.
 */
export async function notifyNewLead(contactName: string, source: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: admins } = await supabase
    .from("crm_users")
    .select("id")
    .in("role", ["super_admin", "admin"]);

  if (!admins || admins.length === 0) return;

  const sourceLabel = source === "google_ads" ? "Google Ads" : source === "meta_ads" ? "Meta Ads" : source === "crm_native" ? "Manual" : source;

  const notifications = admins.map((admin: { id: number }) => ({
    type: "new_lead",
    title: "New Lead",
    message: `${contactName} from ${sourceLabel}`,
    user_id: admin.id,
  }));

  await supabase.from("notifications").insert(notifications);
}
