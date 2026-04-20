import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { findTemplateBySid } from "@/lib/whatsapp-templates";

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
  if (!supabase) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const client = getTwilioClient();
  if (!client) {
    return Response.json(
      { error: "Twilio credentials not configured" },
      { status: 503 }
    );
  }

  const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!whatsappFrom) {
    return Response.json(
      { error: "TWILIO_WHATSAPP_NUMBER not set" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const studentId = String(body.student_id || "").trim();
  const messageBody = String(body.message || "").trim();
  const contentSid = String(body.content_sid || "").trim();
  const clientVariables = (body.variables && typeof body.variables === "object" && !Array.isArray(body.variables))
    ? (body.variables as Record<string, string>)
    : null;
  const userId = Number(body.user_id) || null;

  if (!studentId) {
    return Response.json({ error: "student_id is required" }, { status: 400 });
  }
  if (!messageBody && !contentSid) {
    return Response.json(
      { error: "message or content_sid is required" },
      { status: 400 }
    );
  }

  const { data: student, error: contactErr } = await supabase
    .from("students")
    .select("id, name, phone")
    .eq("id", studentId)
    .single();

  if (contactErr || !student) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const toNumber = student.phone.startsWith("+")
    ? student.phone
    : `+1${student.phone.replace(/\D/g, "")}`;

  // Derive a public callback URL so Twilio can POST delivery/read status
  // updates back to our webhook. Without this, every outbound message stays
  // forever in "queued" state and the UI shows a clock icon permanently.
  const host = request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const scheme = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
  const statusCallback = host ? `${scheme}://${host}/api/whatsapp/webhook` : undefined;

  // Build the Twilio send payload. Content Template sends use contentSid +
  // contentVariables and cannot include a freeform body; we still compute a
  // local preview string to show in the inbox + activity log.
  let templateName: string | null = null;
  let previewText = messageBody;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendArgs: any = {
    from: `whatsapp:${whatsappFrom}`,
    to: `whatsapp:${toNumber}`,
  };
  if (statusCallback) sendArgs.statusCallback = statusCallback;

  if (contentSid) {
    const tpl = findTemplateBySid(contentSid);
    if (!tpl) {
      return Response.json({ error: "Unknown content_sid" }, { status: 400 });
    }

    const firstName = (student.name || "there").split(" ")[0] || "there";
    const vars: Record<string, string> = { name: firstName };

    // Merge client-supplied variables (e.g. time + location for appointment)
    if (clientVariables) {
      for (const [k, v] of Object.entries(clientVariables)) {
        if (typeof v === "string" && v.trim()) vars[k] = v.trim();
      }
    }

    // Validate that every declared variable has a value
    const missing = tpl.variables.filter((v) => !vars[v]);
    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required template variable(s): ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Build Twilio's numeric-keyed contentVariables from the named slots.
    const contentVariables: Record<string, string> = {};
    tpl.variables.forEach((slot, i) => {
      contentVariables[String(i + 1)] = vars[slot];
    });

    sendArgs.contentSid = contentSid;
    sendArgs.contentVariables = JSON.stringify(contentVariables);
    templateName = `${tpl.category}_${tpl.lang.toLowerCase()}`;
    previewText = tpl.render(vars);
  } else {
    sendArgs.body = messageBody;
  }

  try {
    const twilioMsg = await client.messages.create(sendArgs);

    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .insert({
        student_id: studentId,
        direction: "outbound",
        channel: "whatsapp",
        body: previewText,
        template_name: templateName,
        status: twilioMsg.status || "queued",
        twilio_sid: twilioMsg.sid,
        from_number: whatsappFrom,
        to_number: toNumber,
      })
      .select()
      .single();

    if (msgErr) {
      console.error("Failed to save message to DB:", msgErr.message);
    }

    await supabase
      .from("students")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", studentId);

    await supabase
      .from("students")
      .update({ pipeline_status: "Attempted to student" })
      .eq("id", studentId)
      .eq("pipeline_status", "New");

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

    const activityNote = templateName
      ? `WhatsApp template sent (${templateName}): ${previewText.slice(0, 100)}${previewText.length > 100 ? "..." : ""}`
      : `WhatsApp sent: ${previewText.slice(0, 100)}${previewText.length > 100 ? "..." : ""}`;

    await supabase.from("activity_log").insert({
      student_id: studentId,
      channel: "whatsapp",
      message_type: "outbound_message",
      notes: activityNote,
    });

    return Response.json({
      success: true,
      message: msg || { twilio_sid: twilioMsg.sid },
      twilio_status: twilioMsg.status,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Twilio send failed";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
