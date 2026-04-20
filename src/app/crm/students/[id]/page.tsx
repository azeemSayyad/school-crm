"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  Student, StudentProgram,
  Message,
  RetargetChannel,
} from "@/lib/crm-types";
import MessagingModal from "@/components/MessagingModal";
import { useAuth } from "@/lib/auth-context";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ─────────────────────────────────────────────────────────
   Light theme palette (this page only — overrides dark vars)
   ───────────────────────────────────────────────────────── */
const T = {
  bg: "#f5f7fa",
  surface: "#ffffff",
  surfaceAlt: "#f9fafb",
  border: "#e5e8ec",
  borderLight: "#eef0f3",
  text: "#1f2937",
  textSecondary: "#4b5563",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  accent: "#0170B9",
  accentGhost: "#e8f4fb",
  success: "#10b981",
  successGhost: "#ecfdf5",
  warning: "#f59e0b",
  danger: "#ef4444",
  dangerGhost: "#fef2f2",
};

/* ─── Utility Helpers ─── */

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const getHue = (name: string) =>
  name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const fmtMonthYear = (d: string) =>
  new Date(d).toLocaleString("en-US", { month: "long", year: "numeric" });

/* ─── Constant Maps ─── */

const RETARGET_CHANNELS: { value: RetargetChannel; label: string }[] = [
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" },
];

const RECENT_FETCH_LIMIT = 50;       // messages cap for chat widget
const CHAT_PAGE_SIZE = 20;            // Right-sidebar chat pagination size

// Right-column section IDs, in their fallback order when a user has no saved preference.
const DEFAULT_SECTION_ORDER: string[] = ["conversation"];

/* ─────────────────────────────────────────────────────────
   Inline Edit Components — declared OUTSIDE the page component
   so they don't get recreated on each render
   ───────────────────────────────────────────────────────── */

type FieldType = "text" | "email" | "tel" | "textarea";

function InlineField({
  label,
  value,
  onSave,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
  type?: FieldType;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value ?? "")) onSave(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  return (
    <div className="group py-2.5" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: T.textMuted }}>
        {label}
      </div>
      {editing ? (
        type === "textarea" ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
            }}
            rows={3}
            className="w-full text-[13px] outline-none rounded px-2 py-1.5 resize-y"
            style={{
              border: `1px solid ${T.accent}`,
              background: T.surface,
              color: T.text,
              fontFamily: "inherit",
            }}
          />
        ) : (
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            placeholder={placeholder}
            className="w-full text-[13px] outline-none rounded px-2 py-1.5"
            style={{
              border: `1px solid ${T.accent}`,
              background: T.surface,
              color: T.text,
              fontFamily: "inherit",
            }}
          />
        )
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="text-[13px] rounded px-2 py-1.5 -mx-2 cursor-text transition-colors hover:bg-black/[0.03] min-h-[28px]"
          style={{ color: value ? T.text : T.textFaint }}
        >
          {value || placeholder || "—"}
        </div>
      )}
    </div>
  );
}

function InlineSelectField({
  label,
  value,
  options,
  onSave,
  badgeStyle,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string; bg?: string }[];
  onSave: (v: string) => void;
  badgeStyle?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: T.textMuted }}>
        {label}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onSave(e.target.value)}
          className="w-full text-[13px] cursor-pointer appearance-none rounded px-2 py-1.5 -mx-2 outline-none transition-colors hover:bg-black/[0.03] focus:bg-white"
          style={{
            background: badgeStyle && current?.bg ? current.bg : "transparent",
            color: badgeStyle && current?.color ? current.color : T.text,
            border: badgeStyle ? `1px solid ${current?.bg ?? T.borderLight}` : "1px solid transparent",
            fontFamily: "inherit",
            fontWeight: badgeStyle ? 600 : 400,
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ color: T.text, background: T.surface }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null;
  mono?: boolean;
}) {
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: T.textMuted }}>
        {label}
      </div>
      <div className="text-[13px] px-2 -mx-2 min-h-[28px] flex items-center" style={{ color: value != null && value !== "" ? T.text : T.textFaint, fontFamily: mono ? "ui-monospace, monospace" : "inherit" }}>
        {value != null && value !== "" ? value : "—"}
      </div>
    </div>
  );
}

type DragHandleBag = {
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners?: Record<string, (event: unknown) => void>;
  isDragging?: boolean;
};

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  action,
  children,
  dragHandle,
  isOverlay = false,
  forceCollapsed = false,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** When provided, renders a drag grip on the left of the header wired to dnd-kit. */
  dragHandle?: DragHandleBag;
  /** True when this instance is the floating DragOverlay clone — suppresses its source visibility + hover states. */
  isOverlay?: boolean;
  /** Force the section closed regardless of internal open state (used during drag so the preview is a compact header-only card). */
  forceCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const effectiveOpen = open && !forceCollapsed && !isOverlay;
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: isOverlay
          ? "0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.12)"
          : undefined,
      }}
    >
      <div
        className="flex items-center justify-between px-2 py-3 select-none"
        style={{ cursor: isOverlay ? "grabbing" : "pointer" }}
        onClick={() => { if (!isOverlay) setOpen((v) => !v); }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {dragHandle && (
            <div
              {...dragHandle.attributes}
              {...(dragHandle.listeners ?? {})}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-black/[0.05]"
              style={{ color: T.textFaint, cursor: isOverlay ? "grabbing" : "grab", touchAction: "none" }}
              title="Drag to reorder"
              aria-label="Drag to reorder"
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
                <circle cx="2" cy="2" r="1.2" />
                <circle cx="8" cy="2" r="1.2" />
                <circle cx="2" cy="7" r="1.2" />
                <circle cx="8" cy="7" r="1.2" />
                <circle cx="2" cy="12" r="1.2" />
                <circle cx="8" cy="12" r="1.2" />
              </svg>
            </div>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textMuted, transform: effectiveOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{title}</span>
          {count != null && (
            <span className="text-[11px] font-semibold px-1.5 py-px rounded" style={{ background: T.surfaceAlt, color: T.textSecondary }}>
              {count}
            </span>
          )}
        </div>
        {action && <div className="pr-2" onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {effectiveOpen && <div className="px-4 pb-4" style={{ borderTop: `1px solid ${T.borderLight}` }}>{children}</div>}
    </div>
  );
}

/**
 * Wraps any child (a CollapsibleSection) with dnd-kit's useSortable, producing
 * smooth FLIP animations when sibling items reorder. The child decides where
 * to put the drag handle via the `dragHandle` prop threaded by the caller.
 */
function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (bag: { dragHandle: DragHandleBag; isDragging: boolean }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // While this item is being dragged, hide the original in place — the
    // DragOverlay clone follows the cursor instead.
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandle: { attributes, listeners: listeners as DragHandleBag["listeners"], isDragging },
        isDragging,
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Attendance Demo Component (static demo data)
   ───────────────────────────────────────────────────────── */

function AttendanceDemo() {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  // Static demo data — random pattern seeded deterministically
  const demoData = (() => {
    const map: Record<string, "present" | "absent" | "late" | "holiday"> = {};
    const seed = [1,1,1,1,0,1,1,1,0,1,1,"h",1,1,1,0,1,1,1,1,0,0,1,1,1,0,1,1,1,1];
    const year = today.getFullYear();
    const month = today.getMonth();
    // fill previous month too
    for (let m = month - 1; m <= month; m++) {
      const actualMonth = (m + 12) % 12;
      const actualYear = m < 0 ? year - 1 : year;
      const days = new Date(actualYear, actualMonth + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const dow = new Date(actualYear, actualMonth, d).getDay();
        if (dow === 0 || dow === 6) continue; // skip weekends
        const key = `${actualYear}-${String(actualMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const val = seed[(d + actualMonth * 3) % seed.length];
        map[key] = val === "h" ? "holiday" : val === 0 ? "absent" : d % 9 === 0 ? "late" : "present";
      }
    }
    return map;
  })();

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Count stats for viewed month
  let present = 0, absent = 0, late = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(viewYear, viewMonth, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const status = demoData[key];
    if (status === "present") present++;
    else if (status === "absent") absent++;
    else if (status === "late") late++;
  }
  const workingDays = present + absent + late;
  const pct = workingDays > 0 ? Math.round(((present + late) / workingDays) * 100) : 0;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const statusColor = (s: string | undefined) => {
    if (s === "present") return { bg: "#dcfce7", color: "#16a34a" };
    if (s === "absent")  return { bg: "#fee2e2", color: "#dc2626" };
    if (s === "late")    return { bg: "#fef9c3", color: "#ca8a04" };
    if (s === "holiday") return { bg: "#e0e7ff", color: "#6366f1" };
    return { bg: T.surfaceAlt, color: T.textFaint };
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Attendance", value: `${pct}%`, sub: "this month", color: pct >= 75 ? "#16a34a" : "#dc2626", bg: pct >= 75 ? "#dcfce7" : "#fee2e2" },
          { label: "Present", value: present + late, sub: `${late} late`, color: "#16a34a", bg: "#dcfce7" },
          { label: "Absent", value: absent, sub: `of ${workingDays} days`, color: "#dc2626", bg: "#fee2e2" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.textMuted }}>{s.label}</div>
            <div className="text-[22px] font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: T.textMuted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="w-7 h-7 rounded flex items-center justify-center cursor-pointer border-none transition-colors hover:bg-black/[0.05]" style={{ background: "transparent", color: T.textMuted }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="text-[13px] font-extrabold" style={{ color: T.text }}>{monthName}</span>
          <button onClick={nextMonth} className="w-7 h-7 rounded flex items-center justify-center cursor-pointer border-none transition-colors hover:bg-black/[0.05]" style={{ background: "transparent", color: T.textMuted }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold pb-1" style={{ color: T.textMuted }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-[3px]">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dow = new Date(viewYear, viewMonth, d).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const status = isWeekend ? undefined : demoData[key];
            const { bg, color } = statusColor(status);
            const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            return (
              <div
                key={d}
                className="aspect-square rounded flex items-center justify-center text-[11px] font-semibold"
                style={{
                  background: isWeekend ? "transparent" : bg,
                  color: isWeekend ? T.textFaint : color,
                  outline: isToday ? `2px solid ${T.accent}` : "none",
                  outlineOffset: "1px",
                  opacity: isWeekend ? 0.4 : 1,
                }}
                title={status ?? (isWeekend ? "Weekend" : "No record")}
              >
                {d}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3" style={{ borderTop: `1px solid ${T.borderLight}` }}>
          {[
            { label: "Present", bg: "#dcfce7", color: "#16a34a" },
            { label: "Absent",  bg: "#fee2e2", color: "#dc2626" },
            { label: "Late",    bg: "#fef9c3", color: "#ca8a04" },
            { label: "Holiday", bg: "#e0e7ff", color: "#6366f1" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: l.bg, border: `1px solid ${l.color}30` }} />
              <span className="text-[11px]" style={{ color: T.textMuted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Progress Card Demo Component
   ───────────────────────────────────────────────────────── */

const SUBJECTS = ["Telugu", "Hindi", "English", "Maths", "Physics", "Biology", "Social"] as const;

function getGrade(pct: number) {
  if (pct >= 90) return { grade: "A+", color: "#16a34a" };
  if (pct >= 75) return { grade: "A",  color: "#0170B9" };
  if (pct >= 60) return { grade: "B",  color: "#7c3aed" };
  if (pct >= 50) return { grade: "C",  color: "#ca8a04" };
  if (pct >= 35) return { grade: "D",  color: "#ea580c" };
  return { grade: "F", color: "#dc2626" };
}

function ProgressCardDemo({ studentName, standard }: { studentName: string; standard: string | null }) {
  const [marks, setMarks] = useState<Record<string, string>>(() =>
    Object.fromEntries(SUBJECTS.map((s) => [s, ""]))
  );
  const [maxMarks, setMaxMarks] = useState("100");
  const [showCard, setShowCard] = useState(false);

  const max = parseInt(maxMarks) || 100;

  const rows = SUBJECTS.map((sub) => {
    const val = parseInt(marks[sub]);
    const obtained = isNaN(val) ? null : Math.min(val, max);
    const pct = obtained !== null ? Math.round((obtained / max) * 100) : null;
    const gradeInfo = pct !== null ? getGrade(pct) : null;
    return { sub, obtained, pct, gradeInfo };
  });

  const filledRows = rows.filter((r) => r.obtained !== null);
  const totalObtained = filledRows.reduce((a, r) => a + (r.obtained ?? 0), 0);
  const totalMax = filledRows.length * max;
  const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
  const overallGrade = overallPct !== null ? getGrade(overallPct) : null;
  const canGenerate = filledRows.length === SUBJECTS.length;

  return (
    <>
      <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
          <h3 className="text-[15px] font-extrabold" style={{ color: T.text }}>Progress Card</h3>
          <p className="text-[12px] mt-0.5" style={{ color: T.textMuted }}>Enter marks out of max marks per subject</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Max marks */}
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-semibold shrink-0" style={{ color: T.textSecondary }}>Max Marks per Subject</label>
            <input
              type="number"
              value={maxMarks}
              min={1}
              onChange={(e) => setMaxMarks(e.target.value)}
              className="w-20 text-[13px] px-2 py-1.5 rounded outline-none text-center"
              style={{ background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}`, fontFamily: "inherit" }}
            />
          </div>

          {/* Subject rows */}
          <div className="space-y-2">
            {SUBJECTS.map((sub) => {
              const val = parseInt(marks[sub]);
              const obtained = isNaN(val) ? null : Math.min(val, max);
              const pct = obtained !== null ? Math.round((obtained / max) * 100) : null;
              const gradeInfo = pct !== null ? getGrade(pct) : null;
              return (
                <div key={sub} className="flex items-center gap-3">
                  <div className="w-20 text-[12.5px] font-semibold shrink-0" style={{ color: T.textSecondary }}>{sub}</div>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    value={marks[sub]}
                    onChange={(e) => setMarks((m) => ({ ...m, [sub]: e.target.value }))}
                    placeholder={`/ ${max}`}
                    className="w-20 text-[13px] px-2 py-1.5 rounded outline-none text-center"
                    style={{ background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}`, fontFamily: "inherit" }}
                  />
                  {pct !== null && gradeInfo && (
                    <>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: T.borderLight }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: gradeInfo.color }} />
                      </div>
                      <span className="text-[12px] font-bold w-8 text-right" style={{ color: gradeInfo.color }}>{gradeInfo.grade}</span>
                      <span className="text-[11px] w-9 text-right" style={{ color: T.textMuted }}>{pct}%</span>
                    </>
                  )}
                  {pct === null && <div className="flex-1" />}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => canGenerate && setShowCard(true)}
            disabled={!canGenerate}
            className="w-full py-2.5 rounded-lg text-[13px] font-extrabold cursor-pointer border-none transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: T.accent, color: "#fff" }}
          >
            {canGenerate ? "Generate Progress Card" : `Enter marks for all ${SUBJECTS.length} subjects`}
          </button>
        </div>
      </div>

      {/* Progress Card Modal */}
      {showCard && overallGrade && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={() => setShowCard(false)} />
          <div className="fixed inset-4 z-[301] rounded-2xl shadow-2xl overflow-auto" style={{ background: "#fff" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <span className="text-[15px] font-extrabold text-gray-800">Progress Card</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer border transition-colors hover:bg-gray-50"
                  style={{ color: T.accent, borderColor: T.accent + "50" }}
                >
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                  Print
                </button>
                <button onClick={() => setShowCard(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Card content */}
            <div className="max-w-[720px] mx-auto px-8 py-8">
              {/* School header */}
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-xl font-extrabold" style={{ background: T.accent }}>S</div>
                <h1 className="text-[22px] font-extrabold text-gray-900">School Progress Report</h1>
                <p className="text-[13px] text-gray-500 mt-1">Academic Year 2025–26</p>
              </div>

              {/* Student info */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Student Name</div>
                  <div className="text-[15px] font-extrabold text-gray-900">{studentName}</div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Standard</div>
                  <div className="text-[15px] font-extrabold text-gray-900">{standard || "—"}</div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Date Issued</div>
                  <div className="text-[14px] font-semibold text-gray-700">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Max Marks / Subject</div>
                  <div className="text-[14px] font-semibold text-gray-700">{max}</div>
                </div>
              </div>

              {/* Marks table */}
              <table className="w-full mb-6 border-collapse">
                <thead>
                  <tr style={{ background: T.accent }}>
                    <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold text-white rounded-tl-lg">Subject</th>
                    <th className="text-center px-4 py-2.5 text-[11.5px] font-semibold text-white">Max Marks</th>
                    <th className="text-center px-4 py-2.5 text-[11.5px] font-semibold text-white">Obtained</th>
                    <th className="text-center px-4 py-2.5 text-[11.5px] font-semibold text-white">Percentage</th>
                    <th className="text-center px-4 py-2.5 text-[11.5px] font-semibold text-white rounded-tr-lg">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.sub} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                      <td className="px-4 py-2.5 text-[13px] font-semibold text-gray-800 border-b border-gray-100">{r.sub}</td>
                      <td className="px-4 py-2.5 text-[13px] text-center text-gray-600 border-b border-gray-100">{max}</td>
                      <td className="px-4 py-2.5 text-[13px] text-center font-semibold text-gray-800 border-b border-gray-100">{r.obtained ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[13px] text-center text-gray-600 border-b border-gray-100">{r.pct !== null ? `${r.pct}%` : "—"}</td>
                      <td className="px-4 py-2.5 text-center border-b border-gray-100">
                        {r.gradeInfo && (
                          <span className="inline-block px-2 py-0.5 rounded text-[12px] font-extrabold" style={{ background: r.gradeInfo.color + "18", color: r.gradeInfo.color }}>
                            {r.gradeInfo.grade}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: T.accent + "10" }}>
                    <td className="px-4 py-3 text-[13px] font-extrabold text-gray-900 rounded-bl-lg">Total</td>
                    <td className="px-4 py-3 text-[13px] text-center font-bold text-gray-700">{totalMax}</td>
                    <td className="px-4 py-3 text-[13px] text-center font-extrabold text-gray-900">{totalObtained}</td>
                    <td className="px-4 py-3 text-[13px] text-center font-bold" style={{ color: overallGrade.color }}>{overallPct}%</td>
                    <td className="px-4 py-3 text-center rounded-br-lg">
                      <span className="inline-block px-3 py-0.5 rounded text-[13px] font-extrabold" style={{ background: overallGrade.color + "18", color: overallGrade.color }}>
                        {overallGrade.grade}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Overall result */}
              <div className="rounded-xl p-5 text-center" style={{ background: overallGrade.color + "10", border: `1.5px solid ${overallGrade.color}30` }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: overallGrade.color }}>Overall Result</div>
                <div className="text-[40px] font-extrabold leading-none" style={{ color: overallGrade.color }}>{overallGrade.grade}</div>
                <div className="text-[15px] font-semibold mt-1 text-gray-700">{overallPct}% — {totalObtained} / {totalMax}</div>
                <div className="text-[12px] mt-1 text-gray-400">{overallPct! >= 35 ? "PASS" : "FAIL"}</div>
              </div>

              <p className="text-center text-[11px] text-gray-400 mt-8">This is a computer-generated report. No signature required.</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Page Component
   ───────────────────────────────────────────────────────── */

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const canDeleteStudent = user?.role !== "teacher";

  /* ─── Data ─── */
  const [student, setStudent] = useState<Student | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [programs, setPrograms] = useState<StudentProgram[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; username: string }[]>([]);

  /* ─── Right-sidebar chat widget ─── */
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatTotal, setChatTotal] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatChannel, setChatChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  /* ─── UI ─── */
  const [loading, setLoading] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [centerTab, setCenterTab] = useState<"Attendance" | "Progress Card">("Attendance");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ─── Toast ─── */
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, kind: "success" | "error" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, kind });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  /* ─── Right-column section order (per-user, persisted in crm_users.ui_preferences) ─── */
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Pointer activation is delayed by an 8px drag so a plain click on the grip
  // (or anywhere on the header) still expands/collapses without triggering a
  // drag. Keyboard sensor enables arrow-key reordering for a11y.
  const sectionDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crm/users/ui-preferences", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const saved = data?.preferences?.contact_detail_section_order;
        if (Array.isArray(saved) && saved.length > 0) {
          // Keep only known ids, then append any new ids the user hasn't seen yet.
          const filtered = saved.filter((id: unknown): id is string => typeof id === "string" && DEFAULT_SECTION_ORDER.includes(id));
          const missing = DEFAULT_SECTION_ORDER.filter((id) => !filtered.includes(id));
          setSectionOrder([...filtered, ...missing]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const persistSectionOrder = useCallback((order: string[]) => {
    fetch("/api/crm/users/ui-preferences", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "contact_detail_section_order", value: order }),
    }).catch(() => {
      showToast("Couldn't save section order", "error");
    });
  }, [showToast]);

  /* ─── Quick-send messaging modal (SMS / WhatsApp) ─── */
  const [showMessagingModal, setShowMessagingModal] = useState(false);
  const [messagingChannel, setMessagingChannel] = useState<"sms" | "whatsapp">("sms");


  /* ─── Data Fetching ─── */

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured() || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [studentRes, msgRes, programRes] =
      await Promise.all([
        supabase.from("students").select("*").eq("id", id).single(),
        supabase.from("messages").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(RECENT_FETCH_LIMIT),
        supabase.from("student_programs").select("*").eq("student_id", id).order("created_at", { ascending: false }),
      ]);

    if (studentRes.data) setStudent(studentRes.data as Student);
    if (msgRes.data) setMessages(msgRes.data as Message[]);
    if (programRes.data) setPrograms(programRes.data as StudentProgram[]);

    // Assignable users (for bulk assign)
    const { data: usersData } = await supabase
      .from("crm_users")
      .select("id, username")
      .or("role.eq.teacher,can_take_appointments.eq.true")
      .order("username");
    if (usersData) setTeachers(usersData);

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Inline save (single field) ─── */

  const saveField = useCallback(async <K extends keyof Student>(field: K, value: Student[K]) => {
    if (!isSupabaseConfigured() || !student) return;
    const { data, error } = await supabase
      .from("students")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", student.id)
      .select()
      .single();
    if (error) {
      showToast(error.message || "Failed to save", "error");
      return;
    }
    if (data) {
      setStudent(data as Student);
      const fieldLabel = String(field).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      showToast(`${fieldLabel} updated`);
    }
  }, [student, showToast]);

  /* ─── Other handlers (preserved) ─── */

  const handleRetarget = async (channel: RetargetChannel) => {
    if (!student) return;
    const { data } = await supabase
      .from("students")
      .update({
        retarget_count: student.retarget_count + 1,
        last_retarget_date: new Date().toISOString(),
        retarget_channel: channel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", student.id)
      .select()
      .single();
    if (data) {
      setStudent(data as Student);
      showToast(`Marked for ${channel.replace("_", " ")} retarget`);
    }
  };

  const handleDeleteStudent = async () => {
    if (!student || !isSupabaseConfigured()) return;
    if (!canDeleteStudent) return;
    setDeleting(true);
    await supabase.from("students").delete().eq("id", student.id);
    setDeleting(false);
    router.push("/crm/students");
  };


  const addProgram = useCallback(async (programName: string) => {
    if (!isSupabaseConfigured() || !student || !programName) return;
    if (programs.some((p) => p.program_name === programName)) {
      showToast("Already enrolled in that program", "error");
      return;
    }
    const { data, error } = await supabase
      .from("student_programs")
      .insert({
        student_id: student.id,
        program_name: programName,
        program_status: "active",
        enrollment_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (data) {
      setPrograms((prev) => [data as StudentProgram, ...prev]);
      showToast("Program added");
    } else if (error) {
      showToast(error.message, "error");
    }
  }, [student, programs, showToast]);

  const removeProgram = useCallback(async (programId: string) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from("student_programs")
      .delete()
      .eq("id", programId);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setPrograms((prev) => prev.filter((p) => p.id !== programId));
    showToast("Program removed");
  }, [showToast]);

  /* ─── Chat widget: paginated message fetch ─── */
  // Loads the oldest-to-newest slice of `count` messages so the chat renders chronologically (top = oldest loaded).
  const fetchChatPage = useCallback(async (count: number) => {
    if (!isSupabaseConfigured() || !id) return;
    setChatLoading(true);
    const { data, count: total } = await supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .range(0, count - 1);
    if (data) {
      // Reverse so chat renders oldest-at-top, newest-at-bottom
      setChatMessages(([...data] as Message[]).reverse());
    }
    if (typeof total === "number") setChatTotal(total);
    setChatLoading(false);
  }, [id]);

  // Initial load of the last 20 messages
  useEffect(() => {
    if (id) fetchChatPage(CHAT_PAGE_SIZE);
  }, [id, fetchChatPage]);

  // Auto-scroll to bottom on initial load so the newest message is in view.
  // Two passes (sync + rAF) because bubble heights can shift after fonts finish
  // laying out, which would otherwise leave scroll stuck mid-list.
  const didInitialChatScrollRef = useRef(false);
  useLayoutEffect(() => {
    if (!didInitialChatScrollRef.current && chatMessages.length > 0 && chatScrollRef.current) {
      const scroll = () => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      };
      scroll();
      requestAnimationFrame(scroll);
      didInitialChatScrollRef.current = true;
    }
  }, [chatMessages.length]);

  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // When user scrolls to top AND more messages exist, load 20 more older ones
    if (el.scrollTop === 0 && !chatLoading && chatMessages.length < chatTotal) {
      const prevHeight = el.scrollHeight;
      fetchChatPage(chatMessages.length + CHAT_PAGE_SIZE).then(() => {
        // Preserve scroll position so the user's current view doesn't jump
        requestAnimationFrame(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [chatLoading, chatMessages.length, chatTotal, fetchChatPage]);

  const chatProgramName = programs[0]?.program_name || null;

  const handleChatSend = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !student || chatSending) return;

    setChatSending(true);
    const endpoint = chatChannel === "sms" ? "/api/sms/send" : "/api/whatsapp/send";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, message: trimmed, user_id: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to send", "error");
        setChatSending(false);
        return;
      }
      setChatInput("");
      await fetchChatPage(Math.max(chatMessages.length + 1, CHAT_PAGE_SIZE));
      requestAnimationFrame(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      });
    } catch {
      showToast("Failed to send", "error");
    }
    setChatSending(false);
  }, [chatInput, chatChannel, student, chatSending, chatMessages.length, fetchChatPage, showToast, user?.id]);

  /* ─── Loading / Not Found ─── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: T.bg }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="animate-spin">
          <circle cx="12" cy="12" r="10" stroke={T.border} strokeWidth="3" />
          <path d="M12 2a10 10 0 019.75 7.75" stroke={T.accent} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: T.bg }}>
        <div className="text-[19px] font-extrabold" style={{ color: T.text }}>Student not found</div>
        <button
          onClick={() => router.push("/crm/students")}
          className="text-[13px] font-semibold px-4 py-2 rounded-[7px] border-none cursor-pointer text-white"
          style={{ background: T.accent }}
        >
          Back to Students
        </button>
      </div>
    );
  }

  const hue = getHue(student.name);
  const initials = getInitials(student.name);

  /* ─────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────── */

  return (
    <div
      className="lg:h-screen lg:overflow-hidden flex flex-col"
      style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh" }}
    >
      {/* ─── Top Bar (fixed-height, never scrolls) ─── */}
      <div className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between gap-3" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <Link
          href="/crm/students"
          prefetch={true}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline px-2 py-1.5 rounded transition-colors hover:bg-black/[0.04]"
          style={{ color: T.textSecondary }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Students
        </Link>

        {canDeleteStudent && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded border cursor-pointer transition-colors hover:bg-red-50"
            style={{ color: T.danger, borderColor: "rgba(239,68,68,0.3)", background: T.surface }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            Delete
          </button>
        )}
      </div>

      {/* ─── 3-Column Layout (each column scrolls independently on lg+) ─── */}
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside
          className="lg:w-[300px] xl:w-[320px] lg:shrink-0 lg:border-r lg:overflow-y-auto"
          style={{ background: T.surface, borderColor: T.border }}
        >
          <div className="p-5">
            {/* Identity */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-[16px] font-extrabold"
                style={{ background: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 60%, 38%)` }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[18px] font-extrabold truncate leading-tight" style={{ color: T.text }}>{student.name}</h1>
                {student.email && (
                  <a
                    href={`mailto:${student.email}`}
                    className="text-[12px] no-underline hover:underline truncate block"
                    style={{ color: T.accent }}
                  >
                    {student.email}
                  </a>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex gap-2 mb-4 pb-4" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
              <button
                onClick={() => { setMessagingChannel("whatsapp"); setShowMessagingModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border-none font-semibold text-[13px] transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #e8faf0 0%, #d1f4e0 100%)", color: "#1faa54", border: "1px solid rgba(37,211,102,0.2)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
                </svg>
                WhatsApp
              </button>
              <button
                onClick={() => { setMessagingChannel("sms"); setShowMessagingModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border-none font-semibold text-[13px] transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #f3edff 0%, #e6d9ff 100%)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
                </svg>
                SMS
              </button>
            </div>

            {/* About this student */}
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: T.textMuted }}>
              About this student
            </div>
            <div>
              <InlineField label="Name" value={student.name} onSave={(v) => saveField("name", v)} />
              <InlineField label="Phone" value={student.phone} onSave={(v) => saveField("phone", v)} type="tel" />
              <InlineField label="Email" value={student.email} onSave={(v) => saveField("email", v || null)} type="email" />
              <InlineField label="Address" value={student.address} onSave={(v) => saveField("address", v || null)} type="textarea" />
              <InlineField label="Standard/Class" value={student.standard} onSave={(v) => saveField("standard", v || null)} />
              <InlineField label="Notes" value={student.notes} onSave={(v) => saveField("notes", v || null)} type="textarea" />
              <ReadOnlyField label="Joined" value={fmtDate(student.created_at)} />
            </div>

          </div>
        </aside>

        {/* ─── CENTER ─── */}
        <main className="flex-1 min-w-0 flex flex-col lg:min-h-0">
          {/* Tab bar */}
          <div className="shrink-0 flex px-4 sm:px-6" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
            {(["Attendance", "Progress Card"] as const).map((tab) => {
              const isActive = centerTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setCenterTab(tab)}
                  className="shrink-0 px-4 py-3.5 text-[13px] border-none bg-transparent cursor-pointer whitespace-nowrap transition-colors"
                  style={{
                    fontFamily: "inherit",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? T.accent : T.textSecondary,
                    borderBottom: isActive ? `2px solid ${T.accent}` : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <div className="lg:flex-1 lg:overflow-y-auto p-4 sm:p-6 space-y-5">
            {centerTab === "Attendance" && <AttendanceDemo />}
            {centerTab === "Progress Card" && <ProgressCardDemo studentName={student.name} standard={student.standard} />}
          </div>
        </main>

        {/* ─── RIGHT SIDEBAR ─── */}
        <aside
          className={`lg:shrink-0 lg:border-l lg:overflow-y-auto transition-all ${rightOpen ? "lg:w-[400px] xl:w-[440px]" : "lg:w-[44px]"}`}
          style={{ background: rightOpen ? T.surfaceAlt : T.surface, borderColor: T.border }}
        >
          <div>
            {/* Collapse toggle */}
            <div className="hidden lg:flex items-center justify-between p-3" style={{ borderBottom: rightOpen ? `1px solid ${T.border}` : "none" }}>
              {rightOpen && <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: T.textMuted }}>Details</span>}
              <button
                onClick={() => setRightOpen((v) => !v)}
                className="w-7 h-7 rounded flex items-center justify-center cursor-pointer border-none transition-colors hover:bg-black/[0.05]"
                style={{ background: "transparent", color: T.textMuted }}
                aria-label={rightOpen ? "Collapse panel" : "Expand panel"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {rightOpen ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
                </svg>
              </button>
            </div>

            {rightOpen && (() => {
              type SectionBag = { dragHandle?: DragHandleBag; isOverlay?: boolean };
              const sectionRenderers: Record<string, (bag: SectionBag) => React.ReactNode> = {
                conversation: ({ dragHandle, isOverlay }) => (
                <CollapsibleSection
                  title="Conversation"
                  count={chatTotal || undefined}
                  defaultOpen
                  dragHandle={dragHandle}
                  isOverlay={isOverlay}
                  action={
                    <button
                      onClick={() => { setMessagingChannel(chatChannel); setShowMessagingModal(true); }}
                      title="Open full conversation"
                      className="w-7 h-7 rounded flex items-center justify-center cursor-pointer border-none transition-colors hover:bg-black/[0.05]"
                      style={{ background: "transparent", color: T.textMuted }}
                      aria-label="Maximize conversation"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  }
                >
                  <div className="pt-3">
                    {/* Student action row (moved from left sidebar) */}
                    <div className="flex items-center justify-center gap-2 pb-3 mb-3" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                      <button
                        onClick={() => setChatChannel("whatsapp")}
                        title="Use WhatsApp"
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none transition-transform hover:scale-105 active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, #e8faf0 0%, #d1f4e0 100%)",
                          color: "#1faa54",
                          boxShadow: chatChannel === "whatsapp"
                            ? "0 0 0 2px #25d366, inset 0 0 0 1px rgba(37,211,102,0.15)"
                            : "0 1px 2px rgba(37,211,102,0.1), inset 0 0 0 1px rgba(37,211,102,0.15)",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setChatChannel("sms")}
                        title="Use SMS"
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none transition-transform hover:scale-105 active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, #f3edff 0%, #e6d9ff 100%)",
                          color: "#7c3aed",
                          boxShadow: chatChannel === "sms"
                            ? "0 0 0 2px #7c3aed, inset 0 0 0 1px rgba(124,58,237,0.15)"
                            : "0 1px 2px rgba(124,58,237,0.1), inset 0 0 0 1px rgba(124,58,237,0.15)",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
                        </svg>
                      </button>
                    </div>

                    {/* Messages list */}
                    <div
                      ref={chatScrollRef}
                      onScroll={handleChatScroll}
                      className="overflow-y-auto rounded-lg px-2 py-2"
                      style={{ height: 360, background: T.surfaceAlt, border: `1px solid ${T.borderLight}` }}
                    >
                      {chatLoading && chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke={T.textMuted} strokeWidth="3" opacity="0.3" />
                            <path d="M12 2a10 10 0 019.75 7.75" stroke={T.textMuted} strokeWidth="3" strokeLinecap="round" />
                          </svg>
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-[12.5px]" style={{ color: T.textMuted }}>
                          No messages yet.
                        </div>
                      ) : (
                        <>
                          {chatLoading && (
                            <div className="flex items-center justify-center py-2">
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke={T.textMuted} strokeWidth="3" opacity="0.3" />
                                <path d="M12 2a10 10 0 019.75 7.75" stroke={T.textMuted} strokeWidth="3" strokeLinecap="round" />
                              </svg>
                            </div>
                          )}
                          {chatMessages.length < chatTotal && !chatLoading && (
                            <div className="text-center text-[10.5px] pb-2" style={{ color: T.textFaint }}>
                              Scroll up to load older
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5">
                            {chatMessages.map((m) => {
                              const outbound = m.direction === "outbound";
                              const channelColor = m.channel === "whatsapp" ? "#25d366" : m.channel === "sms" ? "#7c3aed" : T.accent;
                              return (
                                <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className="min-w-[80px] max-w-[85%] rounded-lg px-2.5 py-1.5"
                                    style={{
                                      background: outbound ? channelColor : T.surface,
                                      color: outbound ? "#fff" : T.text,
                                      border: outbound ? "none" : `1px solid ${T.borderLight}`,
                                    }}
                                  >
                                    <div className="text-[12.5px] whitespace-pre-wrap break-words">{m.body}</div>
                                    <div className="text-[10px] mt-0.5 text-right" style={{ color: outbound ? "rgba(255,255,255,0.75)" : T.textMuted }}>
                                      {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Inline send */}
                    <div className="mt-2 flex items-end gap-1.5">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSend();
                          }
                        }}
                        placeholder={`Message via ${chatChannel === "whatsapp" ? "WhatsApp" : "SMS"}...`}
                        rows={1}
                        className="flex-1 text-[12.5px] px-2 py-1.5 rounded outline-none resize-none"
                        style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, fontFamily: "inherit", maxHeight: 88 }}
                      />
                      <button
                        onClick={handleChatSend}
                        disabled={!chatInput.trim() || chatSending}
                        className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        style={{ background: chatChannel === "whatsapp" ? "#25d366" : "#7c3aed" }}
                        title="Send"
                      >
                        {chatSending ? (
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                            <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </CollapsibleSection>
                ),
              };

              return (
                <DndContext
                  sensors={sectionDndSensors}
                  collisionDetection={closestCenter}
                  onDragStart={(event: DragStartEvent) => {
                    setActiveDragId(String(event.active.id));
                  }}
                  onDragEnd={(event: DragEndEvent) => {
                    setActiveDragId(null);
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    setSectionOrder((prev) => {
                      const oldIdx = prev.indexOf(String(active.id));
                      const newIdx = prev.indexOf(String(over.id));
                      if (oldIdx === -1 || newIdx === -1) return prev;
                      const next = arrayMove(prev, oldIdx, newIdx);
                      persistSectionOrder(next);
                      return next;
                    });
                  }}
                  onDragCancel={(_event: DragCancelEvent) => setActiveDragId(null)}
                >
                  <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                    <div className="p-4 space-y-3">
                      {sectionOrder.map((id) => {
                        const render = sectionRenderers[id];
                        if (!render) return null;
                        return (
                          <SortableSection key={id} id={id}>
                            {({ dragHandle }) => render({ dragHandle })}
                          </SortableSection>
                        );
                      })}
                    </div>
                  </SortableContext>
                  <DragOverlay
                    dropAnimation={{
                      duration: 220,
                      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
                    }}
                  >
                    {activeDragId && sectionRenderers[activeDragId] ? (
                      <div style={{ cursor: "grabbing" }}>
                        {sectionRenderers[activeDragId]({
                          dragHandle: { attributes: {}, listeners: {} },
                          isOverlay: true,
                        })}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              );
            })()}
          </div>
        </aside>
      </div>

      {/* ─── Toast (bottom-left) ─── */}
      {toast && (
        <div
          className="fixed bottom-5 left-5 z-[300] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-[13px] font-semibold animate-[slideUp_0.2s_ease-out]"
          style={{
            background: toast.kind === "error" ? T.danger : T.text,
            color: "#fff",
            maxWidth: "calc(100vw - 40px)",
          }}
        >
          {toast.kind === "success" ? (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          )}
          {toast.message}
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-[400] bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed z-[401] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[90vw] rounded-2xl shadow-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: T.dangerGhost }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: T.text }}>Delete Student</h3>
                <p className="text-[12.5px] mt-0.5" style={{ color: T.textMuted }}>This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[13px] mb-5" style={{ color: T.textSecondary }}>
              Are you sure you want to delete <strong style={{ color: T.text }}>{student.name}</strong>? All messages and activities for this student will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDeleteStudent} disabled={deleting} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer border-none transition-colors text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: T.danger }}>
                {deleting && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
                {deleting ? "Deleting..." : "Delete Student"}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.textSecondary }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {showMessagingModal && student && (
        <MessagingModal
          student={{
            id: student.id,
            name: student.name,
            phone: student.phone,
            email: student.email,
            language: student.language,
          }}
          initialChannel={messagingChannel}
          onClose={() => setShowMessagingModal(false)}
        />
      )}


      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
