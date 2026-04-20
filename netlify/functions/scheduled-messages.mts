/**
 * Netlify Scheduled Function — Scheduled Messages Dispatcher
 *
 * Runs every minute on Netlify's infra and invokes the Next.js route at
 * /api/cron/scheduled-messages. That route processes any rows in the
 * `scheduled_messages` table whose status is "pending" and whose
 * scheduled_at has already passed, sending them via Twilio (SMS/WhatsApp)
 * or Microsoft Graph (email).
 *
 * Required Netlify env vars:
 *   CRON_SECRET   — sent as Bearer; the route currently doesn't enforce it
 *                   but we forward it defensively in case auth is added later
 *   URL           — auto-provided by Netlify, points at the deploy URL
 *
 * Netlify auto-discovers files in `netlify/functions/`. The `config.schedule`
 * export wires up the cron — no netlify.toml entry needed.
 */

type ScheduledFunctionConfig = { schedule: string };

async function handler(): Promise<Response> {
  const baseUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl) {
    console.error("[scheduled-messages] Missing env: URL");
    return new Response(
      JSON.stringify({ success: false, error: "Missing env: URL" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const target = `${baseUrl}/api/cron/scheduled-messages`;

  try {
    const res = await fetch(target, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    });
    const body = await res.text();
    console.log(`[scheduled-messages] ${res.status} ${target} → ${body}`);
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scheduled-messages] Fetch failed:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export default handler;

export const config: ScheduledFunctionConfig = {
  schedule: "* * * * *", // every 1 minute
};
