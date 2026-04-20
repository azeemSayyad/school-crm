import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { findDuplicateByPhone, handleReturningLead } from "@/lib/duplicate-check";
import { notifyNewLead } from "@/lib/notify";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

const SOURCE_TO_DATA_SOURCE: Record<string, string> = {
  google_ads: "google_ads",
  google: "google_ads",
  meta_ads: "meta_ads",
  meta: "meta_ads",
  facebook: "meta_ads",
  instagram: "meta_ads",
  whatsapp: "whatsapp",
  walk_in: "walk_in",
  walkin: "walk_in",
};

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || !phone) {
    return Response.json({ error: "name and phone are required" }, { status: 400 });
  }

  const email = String(body.email || "").trim() || null;
  const address = String(body.address || "").trim() || null;
  const standard = String(body.standard || "").trim() || null;
  const source = String(body.source || "crm_native").trim().toLowerCase();
  const notes = String(body.notes || "").trim() || null;
  const language = String(body.language || "EN").trim().toUpperCase();

  const data_source = SOURCE_TO_DATA_SOURCE[source] || "crm_native";

  const existing = await findDuplicateByPhone(phone);
  if (existing) {
    await handleReturningLead(existing.id, { data_source }, data_source);
    return Response.json({
      success: true,
      merged: true,
      student_id: existing.id,
      existing_name: existing.name,
    }, { status: 200 });
  }

  const studentData = {
    name,
    phone,
    email,
    address,
    standard,
    language: language === "ES" ? "ES" : "EN",
    data_source,
    notes,
  };

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert(studentData)
    .select()
    .single();

  if (studentError) {
    return Response.json({ error: studentError.message }, { status: 500 });
  }

  await supabase.from("activity_log").insert({
    student_id: student.id,
    channel: data_source === "google_ads" || data_source === "meta_ads" ? data_source : "other",
    message_type: "lead_created",
    notes: `Lead created from ${source}`,
  });

  await supabase.from("student_payments").insert({
    student_id: student.id,
    payment_status: "N/A",
  });

  await notifyNewLead(student.name, data_source);

  return Response.json({ success: true, student }, { status: 201 });
}
