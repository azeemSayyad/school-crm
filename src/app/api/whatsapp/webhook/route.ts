import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase() {
  if (!supabaseUrl.startsWith("http") || supabaseKey.length < 10) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ─── Twilio WhatsApp Webhook ───
// Twilio sends two types of webhooks here:
// 1. Inbound messages — when a student replies
// 2. Status callbacks — delivery status updates (sent, delivered, read, failed)
//
// Twilio sends data as application/x-www-form-urlencoded (NOT JSON).

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    // Twilio expects 200 or it retries
    return new Response("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  // ─── Status callback (delivery updates) ───
  if (params.MessageStatus && params.MessageSid) {
    await supabase
      .from("messages")
      .update({ status: params.MessageStatus })
      .eq("twilio_sid", params.MessageSid);

    return new Response("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // ─── Inbound message ───
  const body = params.Body || "";
  const from = (params.From || "").replace("whatsapp:", "");
  const to = (params.To || "").replace("whatsapp:", "");
  const twilioSid = params.MessageSid || params.SmsSid || "";

  if (!from || !body) {
    return new Response("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Strip whatsapp prefix and country code variations to match student
  const phoneVariants = [
    from,
    from.replace(/^\+1/, ""),
    from.replace(/^\+/, ""),
  ];

  // Find the student by phone number
  let studentId: string | null = null;

  for (const phone of phoneVariants) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .or(`phone.eq.${phone},phone.eq.+${phone},phone.eq.+1${phone}`)
      .limit(1)
      .single();

    if (data) {
      studentId = data.id;
      break;
    }
  }

  // If no match, create a new student
  if (!studentId) {
    const { data: newStudent, error } = await supabase
      .from("students")
      .insert({
        name: params.ProfileName || `WhatsApp ${from}`,
        phone: from,
        data_source: "whatsapp",
        lead_type: "manual",
      })
      .select()
      .single();

    if (error || !newStudent) {
      console.error("Failed to create student for inbound WhatsApp:", error?.message);
      return new Response("<Response/>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    studentId = newStudent.id;

    // Default payment record
    await supabase.from("student_payments").insert({
      student_id: studentId,
      payment_status: "N/A",
    });
  }

  // Save the inbound message
  await supabase.from("messages").insert({
    student_id: studentId,
    direction: "inbound",
    channel: "whatsapp",
    body,
    status: "delivered",
    twilio_sid: twilioSid,
    from_number: from,
    to_number: to,
  });

  // Update last_message_at
  await supabase
    .from("students")
    .update({
      last_message_at: new Date().toISOString(),
    })
    .eq("id", studentId);

  // Log activity
  await supabase.from("activity_log").insert({
    student_id: studentId,
    channel: "whatsapp",
    message_type: "inbound_message",
    notes: `WhatsApp received: ${body.slice(0, 100)}${body.length > 100 ? "..." : ""}`,
  });

  // Return empty TwiML (no auto-reply — teachers reply from the CRM inbox)
  return new Response("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
