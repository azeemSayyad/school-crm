import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "Database not configured" }, { status: 503 });

  const client = getTwilioClient();
  if (!client) return Response.json({ error: "Twilio not configured" }, { status: 503 });

  const smsFrom = process.env.TWILIO_SMS_NUMBER;
  if (!smsFrom) return Response.json({ error: "TWILIO_SMS_NUMBER not set" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const studentId = String(body.student_id || "").trim();
  const message = String(body.message || "").trim();
  const userId = Number(body.user_id) || null;

  if (!studentId) return Response.json({ error: "student_id required" }, { status: 400 });
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const { data: student, error: contactErr } = await supabase
    .from("students").select("id, name, phone").eq("id", studentId).single();

  if (contactErr || !student) return Response.json({ error: "Student not found" }, { status: 404 });

  const toNumber = student.phone.startsWith("+") ? student.phone : `+1${student.phone.replace(/\D/g, "")}`;

  try {
    const msg = await client.messages.create({ body: message, from: smsFrom, to: toNumber });

    const { data: savedMsg } = await supabase
      .from("messages")
      .insert({
        student_id: studentId,
        direction: "outbound",
        channel: "sms",
        body: message,
        status: msg.status || "queued",
        twilio_sid: msg.sid,
        from_number: smsFrom,
        to_number: toNumber,
      })
      .select()
      .single();

    await supabase.from("students").update({ last_message_at: new Date().toISOString() }).eq("id", studentId);

    // Flip lead status to "Attempted to student" if still New
    await supabase.from("students").update({ pipeline_status: "Attempted to student" }).eq("id", studentId).eq("pipeline_status", "New");

    // Stamp the first user to student this lead (only if not already set)
    if (userId) {
      await supabase
        .from("students")
        .update({
          first_contacted_by: userId,
          first_contacted_at: new Date().toISOString(),
        })
        .eq("id", studentId)
        .is("first_contacted_by", null);
    }

    await supabase.from("activity_log").insert({
      student_id: studentId,
      channel: "sms",
      message_type: "outbound_message",
      notes: `SMS sent: ${message.slice(0, 100)}${message.length > 100 ? "..." : ""}`,
    });

    return Response.json({ success: true, message: savedMsg, twilio_status: msg.status });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "SMS send failed";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
