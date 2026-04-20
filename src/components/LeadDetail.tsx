"use client";

import { useState } from "react";
import { STAGES, STAGE_META, type Lead, type Stage } from "@/lib/types";
import { fmtFull, fmtDT } from "@/lib/utils";
import { Avatar, Badge, StageBadge, SectionLabel } from "./ui";
import { Icons } from "./Icons";

export default function LeadDetail({
  lead, onClose, onUpdate,
}: {
  lead: Lead; onClose: () => void;
  onUpdate: (id: number, updates: Partial<Lead>) => void;
}) {
  const [notes, setNotes] = useState(lead.notes);
  const [stage, setStage] = useState<Stage>(lead.stage);
  const save = () => onUpdate(lead.id, { notes, stage });
  const q = lead.qualification || {};

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) { save(); onClose(); } }}>
      <div className="absolute inset-0 backdrop-blur-[3px]" style={{ background: "rgba(10,10,25,0.35)" }}
        onClick={() => { save(); onClose(); }} />
      <div className="relative w-full max-w-full sm:max-w-[560px] bg-[var(--c-bg)] h-full overflow-y-auto shadow-[-12px_0_40px_rgba(0,0,0,0.12)] animate-[slideIn_0.2s_ease]">
        {/* Header */}
        <div className="px-4 md:px-[22px] py-4 border-b border-[var(--c-border)] flex items-center gap-3 sticky top-0 bg-[var(--c-bg)] z-[2]">
          <Avatar name={lead.name} size={38} />
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-[17px] font-[750] text-[var(--c-text)] tracking-tight m-0">{lead.name}</h2>
            <div className="flex gap-[5px] mt-1 flex-wrap">
              <StageBadge stage={lead.stage} />
            </div>
          </div>
          <button onClick={() => { save(); onClose(); }}
            className="bg-transparent border-none cursor-pointer text-[var(--c-text-muted)] p-1 flex">{Icons.x}</button>
        </div>

        <div className="p-4 md:p-[18px_22px] flex flex-col gap-5 md:gap-[22px]">
          {/* Student */}
          <div>
            <SectionLabel>Student</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                [Icons.phone, "Phone", lead.phone], [Icons.mail, "Email", lead.email],
                [Icons.cal, "Date Added", fmtFull(lead.dateAdded)], [Icons.globe, "Language", lead.language === "ES" ? "Spanish" : "English"],
                [Icons.wa, "Source", lead.source], [Icons.cal, "Appointment", fmtDT(lead.appointmentDate)],
              ].map(([icon, label, val], i) => (
                <div key={i} className="flex items-center gap-[9px] p-[9px_12px] bg-[var(--c-bg-subtle)] rounded-lg border border-[var(--c-border-light)]">
                  <span className="text-[var(--c-text-muted)] flex shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <div className="text-[10px] text-[var(--c-text-muted)] font-semibold uppercase tracking-[0.04em]">{label as string}</div>
                    <div className="text-[12.5px] text-[var(--c-text)] font-[550] whitespace-nowrap overflow-hidden text-ellipsis">{val as string}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage */}
          <div>
            <SectionLabel>Update Stage</SectionLabel>
            <div className="flex flex-wrap gap-[5px]">
              {STAGES.map((s) => {
                const active = stage === s; const sm = STAGE_META[s];
                return (
                  <button key={s} onClick={() => setStage(s)}
                    className="px-[11px] py-[5px] rounded-[6px] text-[11.5px] font-semibold cursor-pointer font-[inherit] transition-all"
                    style={{ border: active ? `1.5px solid ${sm.color}` : "1px solid var(--c-border)", background: active ? sm.bg : "var(--c-surface)", color: active ? sm.color : "var(--c-text-secondary)" }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Qualification */}
          <div>
            <SectionLabel>Qualification Answers</SectionLabel>
            <div className="rounded-[9px] border border-[var(--c-border)] overflow-hidden">
              {[
                ["GED / Diploma", q.ged], ["Legal Status", q.legalStatus],
                ["Availability", q.availability], ["Prior Experience", q.experience],
                ["Transportation", q.transportation], ["Desired Start", q.startDate],
              ].map(([label, val], i, arr) => (
                <div key={i} className="flex justify-between items-center px-[13px] py-2"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--c-border-light)" : "none", background: i % 2 === 0 ? "var(--c-surface)" : "var(--c-bg-subtle)" }}>
                  <span className="text-xs text-[var(--c-text-secondary)]">{label}</span>
                  <span className="text-xs font-[650]"
                    style={{ color: val === "Unknown" ? "var(--c-text-muted)" : val === "No" ? "#dc2626" : val === "Yes" ? "#16a34a" : "var(--c-text)" }}>
                    {val || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <SectionLabel>WhatsApp Thread</SectionLabel>
            <div className="rounded-[10px] p-2.5 max-h-[260px] overflow-y-auto" style={{ background: "#ece5dd" }}>
              {lead.whatsappLog.length === 0 && <div className="text-center py-6 text-xs" style={{ color: "#8e8378" }}>No messages</div>}
              {lead.whatsappLog.map((msg, i) => (
                <div key={i} className="flex mb-[5px]" style={{ justifyContent: msg.from === "ai" ? "flex-start" : "flex-end" }}>
                  <div className="max-w-[85%] sm:max-w-[78%] px-[9px] py-1.5"
                    style={{ borderRadius: msg.from === "ai" ? "2px 8px 8px 8px" : "8px 2px 8px 8px", background: msg.from === "ai" ? "#fff" : "#d9fdd3", boxShadow: "0 1px 1px rgba(0,0,0,0.05)" }}>
                    <div className="text-xs leading-[1.4]" style={{ color: "#111b21" }}>{msg.text}</div>
                    <div className="text-[9px] text-right mt-0.5" style={{ color: "#8696a0" }}>{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Internal Notes</SectionLabel>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Add notes about this lead…"
              className="w-full p-[10px_12px] border border-[var(--c-border)] rounded-lg text-[13px] font-[inherit] outline-none resize-y bg-[var(--c-surface)] text-[var(--c-text)] focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px_var(--c-accent-ghost)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
