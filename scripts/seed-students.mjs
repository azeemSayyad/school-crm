#!/usr/bin/env node
/**
 * Seed 10 students for every class (Nursery, LKG, UKG, 1-10).
 * Total: 13 classes × 10 students = 130 students.
 *
 * Usage:
 *   node scripts/seed-students.mjs
 *
 * Reads .env.local for Supabase credentials.
 * Safe to re-run — uses upsert on phone number.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
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
if (!url || !key) { console.error("Missing Supabase credentials in .env.local"); process.exit(1); }

const supabase = createClient(url, key);

/* ── Classes (values match ClassSelector.tsx) ── */
const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/* ── 10 first names and 10 last names to mix ── */
const FIRST = ["Aarav", "Aisha", "Rohan", "Priya", "Kabir", "Sneha", "Arjun", "Meera", "Vivaan", "Ananya"];
const LAST  = ["Sharma", "Patel", "Singh", "Mehta", "Gupta", "Khan", "Joshi", "Verma", "Rao", "Nair"];

const STREETS = [
  "12 MG Road", "45 Nehru Nagar", "7 Gandhi Chowk", "3 Civil Lines",
  "88 Lake View", "21 Shivaji Marg", "56 Green Park", "9 Tilak Street",
  "34 Sadar Bazaar", "67 Station Road",
];

const NOTES = [
  "Parents prefer morning contact.",
  "Scholarship student – fee waiver applied.",
  "Transport facility opted.",
  "Has food allergy – no nuts.",
  "Joined mid-semester.",
  "Excellent in Mathematics.",
  "Needs extra attention in English.",
  "Active in sports activities.",
  "Guardian is the grandmother.",
  "Sibling also enrolled.",
];

/* ── Build 130 student records ── */
const students = [];

CLASSES.forEach((std, ci) => {
  for (let i = 0; i < 10; i++) {
    const first = FIRST[i];
    const last  = LAST[(ci + i) % 10];   // rotate last names across classes
    // Phone: 9800000000 + class-index * 100 + student-index
    const phone = `98${String(ci).padStart(2, "0")}${String(i).padStart(3, "0")}${String(ci * 10 + i).padStart(3, "0")}`;
    students.push({
      name:     `${first} ${last}`,
      phone:    phone.slice(0, 10),       // keep exactly 10 digits
      address:  STREETS[i],
      standard: std,
      notes:    NOTES[i],
      pipeline_status: "New",
      data_source:     "seed",
    });
  }
});

/* ── Fix phone to 10 unique digits ── */
// Re-generate phones as a simple sequential series to guarantee uniqueness.
students.forEach((s, idx) => {
  s.phone = `9${String(8000000000 + idx).slice(1)}`; // e.g. 9800000000 .. 9800000129
});

async function main() {
  console.log(`\nSeeding ${students.length} students (10 per class)…\n`);

  const { data, error } = await supabase
    .from("students")
    .upsert(students, { onConflict: "phone" })
    .select("id, name, standard");

  if (error) {
    console.error("✗ Seed failed:", error.message);
    console.error("  Details:", error.details ?? "—");
    process.exit(1);
  }

  /* Summary by class */
  const summary = {};
  for (const s of (data ?? [])) {
    summary[s.standard] = (summary[s.standard] ?? 0) + 1;
  }

  const classLabels = {
    Nursery: "Nursery", LKG: "LKG", UKG: "UKG",
    "1": "Class I", "2": "Class II", "3": "Class III", "4": "Class IV",
    "5": "Class V", "6": "Class VI", "7": "Class VII", "8": "Class VIII",
    "9": "Class IX", "10": "Class X",
  };

  console.log("✓ Done!\n");
  console.log("Students inserted / updated per class:");
  for (const [k, label] of Object.entries(classLabels)) {
    const n = summary[k] ?? 0;
    console.log(`  ${label.padEnd(12)} ${n} student${n !== 1 ? "s" : ""}`);
  }
  console.log(`\n  Total: ${(data ?? []).length} records\n`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
