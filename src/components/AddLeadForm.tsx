"use client";

import { useState } from "react";
import { SOURCES } from "@/lib/types";
import { Input, Select } from "./ui";
import { Icons } from "./Icons";

interface LeadForm { name: string; phone: string; email: string; language: string; source: string; notes: string; }

export default function AddLeadForm({ onAdd }: { onAdd: (form: LeadForm) => void }) {
  const empty: LeadForm = { name: "", phone: "", email: "", language: "ES", source: "Google", notes: "" };
  const [form, setForm] = useState(empty);
  const [success, setSuccess] = useState(false);
  const s = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    onAdd(form); setForm(empty); setSuccess(true); setTimeout(() => setSuccess(false), 3500);
  };
  const ready = form.name.trim() && form.phone.trim();

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] gap-0 h-full overflow-auto lg:overflow-hidden" style={{ margin: "-12px -12px" }}>
      {/* Left: Form */}
      <div className="p-4 md:p-[32px_40px] overflow-y-auto">
        {success && (
          <div className="flex items-center gap-2.5 p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-[10px] text-[13.5px] font-semibold mb-6 animate-[fadeUp_0.3s_ease]">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-[15px] shrink-0">✓</div>
            <div>
              <div>Lead added to pipeline</div>
              <div className="text-xs font-[450] text-green-400 mt-[1px]">They&apos;ll appear in the New Lead column</div>
            </div>
          </div>
        )}
        {/* Student */}
        <div className="mb-7">
          <div className="text-[15px] font-[750] text-[var(--c-text)] tracking-tight mb-1">Student Information</div>
          <div className="text-[12.5px] text-[var(--c-text-muted)] mb-[18px]">Required fields are marked with *</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2"><Input label="Full Name *" value={form.name} onChange={(e) => s("name", e.target.value)} placeholder="e.g. Maria García" /></div>
            <Input label="Phone Number *" value={form.phone} onChange={(e) => s("phone", e.target.value)} placeholder="+1 (305) 555-0000" />
            <Input label="Email Address" value={form.email} onChange={(e) => s("email", e.target.value)} placeholder="email@example.com" />
          </div>
        </div>

        <div className="h-px bg-[var(--c-border)] mb-7" />

        {/* Source & Language */}
        <div className="mb-7">
          <div className="text-[15px] font-[750] text-[var(--c-text)] mb-1 tracking-tight">Source & Language</div>
          <div className="text-[12.5px] text-[var(--c-text-muted)] mb-[18px]">Select the lead origin and preferred language</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="text-xs font-semibold text-[var(--c-text-secondary)] mb-1.5">Language</div>
              <div className="flex border border-[var(--c-border)] rounded-lg overflow-hidden">
                {(["EN", "ES"] as const).map((code) => (
                  <button key={code} onClick={() => s("language", code)}
                    className="flex-1 py-[9px] border-none text-[12.5px] font-semibold cursor-pointer font-[inherit] transition-all"
                    style={{ background: form.language === code ? "var(--c-accent)" : "var(--c-surface)", color: form.language === code ? "#fff" : "var(--c-text-secondary)" }}>
                    {code === "EN" ? "English" : "Spanish"}
                  </button>
                ))}
              </div>
            </div>
            <Select label="Lead Source" value={form.source} onChange={(e) => s("source", e.target.value)}>
              {SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </div>
        </div>

        <div className="h-px bg-[var(--c-border)] mb-7" />

        {/* Notes */}
        <div className="mb-7">
          <div className="text-[15px] font-[750] text-[var(--c-text)] mb-1 tracking-tight">Additional Info</div>
          <div className="text-[12.5px] text-[var(--c-text-muted)] mb-[18px]">Any context that&apos;ll help during outreach</div>
          <div className="flex flex-col gap-[5px]">
            <label className="text-xs font-semibold text-[var(--c-text-secondary)]">Internal Notes</label>
            <textarea value={form.notes} onChange={(e) => s("notes", e.target.value)} rows={4}
              placeholder="e.g. Referred by current student, prefers evening classes…"
              className="w-full p-[10px_12px] border border-[var(--c-border)] rounded-lg text-[13px] font-[inherit] outline-none resize-y bg-[var(--c-surface)] text-[var(--c-text)] leading-[1.5] focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px_var(--c-accent-ghost)]" />
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button onClick={submit}
            className="inline-flex items-center gap-2 px-7 py-[11px] rounded-[9px] text-sm font-bold cursor-pointer font-[inherit] border-none transition-all w-full sm:w-auto justify-center"
            style={{ background: ready ? "var(--c-accent)" : "var(--c-bg-subtle)", color: ready ? "#fff" : "var(--c-text-muted)", boxShadow: ready ? "0 4px 14px rgba(59,59,247,0.25)" : "none", cursor: ready ? "pointer" : "default" }}>
            {Icons.plus} Add Lead to Pipeline
          </button>
          {!ready && <span className="text-xs text-[var(--c-text-muted)]">Fill in name and phone to continue</span>}
        </div>
      </div>

      {/* Right: Preview Panel */}
      <div className="bg-[var(--c-bg-subtle)] border-t lg:border-t-0 lg:border-l border-[var(--c-border)] p-4 md:p-[32px_24px] flex flex-col gap-5 overflow-y-auto">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)] mb-2.5">Card Preview</div>
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] p-[14px_16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-[var(--c-text)] whitespace-nowrap overflow-hidden text-ellipsis">{form.name || "Lead Name"}</div>
                <div className="text-[11.5px] text-[var(--c-text-muted)]">{form.phone || "+1 (___) ___-____"}</div>
              </div>
              <span className="text-[10px] text-[var(--c-text-muted)] font-medium">Today</span>
            </div>
            <div className="flex gap-3 mt-0.5 text-[11.5px] text-[var(--c-text-secondary)] flex-wrap">
              <span>{form.language === "ES" ? "Spanish" : "English"}</span><span className="text-[var(--c-text-muted)]">·</span>
              <span>{form.source}</span>
            </div>
            {form.email && <div className="flex items-center gap-[5px] mt-2 text-[11px] text-[var(--c-text-muted)]">{Icons.mail} {form.email}</div>}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)] mb-2.5">What Happens Next</div>
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] p-[14px_16px]">
            {[
              { step: "1", label: "Lead Created", desc: "Added to the New Lead column" },
              { step: "2", label: "AI Outreach", desc: "WhatsApp bot students within minutes" },
              { step: "3", label: "Qualification", desc: "7 questions asked automatically" },
              { step: "4", label: "Booking", desc: "Qualified leads get an appointment" },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start" style={{ marginBottom: i < 3 ? 12 : 0 }}>
                <div className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-[1px]"
                  style={{ background: i === 0 ? "var(--c-accent)" : "var(--c-bg-subtle)", color: i === 0 ? "#fff" : "var(--c-text-muted)" }}>{item.step}</div>
                <div>
                  <div className="text-[12.5px] font-[650] text-[var(--c-text)]">{item.label}</div>
                  <div className="text-[11.5px] text-[var(--c-text-muted)] mt-[1px]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
