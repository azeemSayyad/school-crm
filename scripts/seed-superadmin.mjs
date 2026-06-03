#!/usr/bin/env node
/**
 * Seed script: Insert the super_admin user into the `users` table.
 *
 * Usage:
 *   node scripts/seed-superadmin.mjs
 *
 * It reads credentials from .env.local (SUPABASE_SERVICE_ROLE_KEY is preferred
 * so it can bypass RLS). Safe to run multiple times — uses upsert on username.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Minimal .env.local loader
function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("Could not read .env.local:", err.message);
    process.exit(1);
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const SUPER_ADMIN = {
  username: "azeem",
  password: "123",
  role: "super_admin",
};

async function main() {
  console.log(`\nInserting super_admin: "${SUPER_ADMIN.username}" …`);

  // upsert so re-running is safe (updates password/role if user already exists)
  const { data, error } = await supabase
    .from("users")
    .upsert(SUPER_ADMIN, { onConflict: "username" })
    .select("id, username, role");

  if (error) {
    console.error("✗ Failed to upsert super_admin:", error.message);
    console.error("  Details:", error.details ?? "—");
    process.exit(1);
  }

  const user = data?.[0];
  console.log(`✓ Super admin ready!`);
  console.log(`  ID       : ${user?.id}`);
  console.log(`  Username : ${user?.username}`);
  console.log(`  Role     : ${user?.role}`);
  console.log(`  Password : ${SUPER_ADMIN.password}  (stored as plain-text per current auth.ts)\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
