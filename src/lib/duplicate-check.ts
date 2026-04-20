import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Check if a student with the given phone number already exists.
 * Returns the existing student ID and name if found, null otherwise.
 */
export async function findDuplicateByPhone(phone: string): Promise<{ id: string; name: string } | null> {
  const supabase = getSupabase();
  if (!supabase || !phone) return null;

  const normalized = phone.replace(/[\s\-\(\)]/g, "");
  const variants = [
    normalized,
    normalized.replace(/^\+1/, ""),
    normalized.replace(/^\+/, ""),
  ];

  for (const variant of variants) {
    if (!variant) continue;
    const { data } = await supabase
      .from("students")
      .select("id, name")
      .or(`phone.eq.${variant},phone.eq.+${variant},phone.eq.+1${variant}`)
      .limit(1)
      .single();

    if (data) return { id: data.id, name: data.name };
  }

  return null;
}

/**
 * Handle a returning lead:
 * - Update campaign data
 * - Log touch activity
 */
export async function handleReturningLead(
  studentId: string,
  campaignUpdates: Record<string, unknown>,
  source: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(campaignUpdates)) {
    if (value !== null && value !== undefined && value !== "") {
      filtered[key] = value;
    }
  }
  if (Object.keys(filtered).length > 0) {
    await supabase.from("students").update(filtered).eq("id", studentId);
  }

  const { data: student } = await supabase.from("students").select("touch_count").eq("id", studentId).single();
  if (student) {
    await supabase.from("students").update({ touch_count: (student.touch_count || 0) + 1 }).eq("id", studentId);
  }

  await supabase.from("activity_log").insert({
    student_id: studentId,
    channel: source === "meta_ads" ? "meta_ads" : source === "google_ads" ? "google_ads" : "other",
    message_type: "duplicate_touch",
    notes: `Returning lead — updated campaign data`,
  });
}
