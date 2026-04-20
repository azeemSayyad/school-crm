/**
 * Netlify Scheduled Function — Meta Lead Ads Poller
 *
 * Runs every 3 minutes on Netlify's infra. All this does is invoke the
 * Next.js route at /api/cron/meta-poll with the bearer token. Keeping the
 * real logic in the Next.js route means it's also manually triggerable via
 * curl, and it shares all of the project's existing imports/aliases.
 *
 * Required Netlify env vars:
 *   CRON_SECRET   — same value as the route checks
 *   URL           — auto-provided by Netlify, points at the deploy URL
 *
 * To deploy: Netlify auto-discovers this file because it lives in
 * `netlify/functions/`. The `config.schedule` export tells Netlify to run
 * it on a cron, no extra netlify.toml entry needed.
 */

// We intentionally don't import `@netlify/functions` here so the project
// doesn't take on a new runtime dependency for what is purely a build-time
// config contract. Netlify reads the `config` export at deploy time to wire
// up the schedule; the local type below mirrors the relevant fields.
type ScheduledFunctionConfig = { schedule: string };

async function handler(): Promise<Response> {
  const baseUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    const missing = [!baseUrl && "URL", !secret && "CRON_SECRET"].filter(Boolean).join(", ");
    console.error(`[meta-poll-scheduled] Missing env: ${missing}`);
    return new Response(
      JSON.stringify({ success: false, error: `Missing env: ${missing}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const target = `${baseUrl}/api/cron/meta-poll`;

  try {
    const res = await fetch(target, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    console.log(`[meta-poll-scheduled] ${res.status} ${target} → ${body}`);
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[meta-poll-scheduled] Fetch failed:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export default handler;

export const config: ScheduledFunctionConfig = {
  schedule: "*/3 * * * *", // every 3 minutes
};
