#!/usr/bin/env node
/**
 * One-shot migration: bcrypt-hash any plain-text passwords still in
 * the crm_users table.
 *
 * You don't STRICTLY need to run this — the login route lazy-migrates
 * each user the first time they log in after deploy. But if you want to
 * eliminate plain-text passwords from the database immediately (e.g.
 * before snapshotting the DB or sharing a backup), run:
 *
 *     node scripts/migrate-passwords.mjs
 *
 * The script:
 *   - Loads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
 *   - Reads every row in crm_users
 *   - Skips rows whose password already starts with $2a$/$2b$/$2y$ (already bcrypt)
 *   - Hashes the rest with bcrypt cost 12 and updates the row in place
 *   - Prints a summary
 *
 * Idempotent — safe to run multiple times.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Minimal .env.local loader — avoids pulling in dotenv for one script.
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const BCRYPT_PREFIX = /^\$2[aby]\$/;

async function main() {
  console.log("Loading crm_users...");
  const { data: users, error } = await supabase
    .from("crm_users")
    .select("id, username, password");

  if (error) {
    console.error("Failed to read crm_users:", error.message);
    process.exit(1);
  }
  if (!users || users.length === 0) {
    console.log("No users found. Nothing to do.");
    return;
  }

  let alreadyHashed = 0;
  let migrated = 0;
  let failed = 0;

  for (const u of users) {
    if (!u.password) {
      console.log(`  - skipping ${u.username} (id ${u.id}): no password set`);
      continue;
    }
    if (BCRYPT_PREFIX.test(u.password)) {
      alreadyHashed++;
      continue;
    }

    const hashed = await bcrypt.hash(u.password, 12);
    const { error: updateErr } = await supabase
      .from("crm_users")
      .update({ password: hashed })
      .eq("id", u.id);

    if (updateErr) {
      console.error(`  ✗ ${u.username} (id ${u.id}): ${updateErr.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${u.username} (id ${u.id}) — hashed`);
      migrated++;
    }
  }

  console.log("");
  console.log(`Done. ${migrated} migrated, ${alreadyHashed} already hashed, ${failed} failed.`);
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
