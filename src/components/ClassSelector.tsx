"use client";

/** All school classes in order, each with a unique colour palette. */
export const CLASS_LIST = [
  { value: "Nursery", label: "Nursery", bg: "#fdf4ff", border: "#e879f9", text: "#a21caf", dot: "#d946ef" },
  { value: "LKG",     label: "LKG",     bg: "#fff7ed", border: "#fb923c", text: "#c2410c", dot: "#f97316" },
  { value: "UKG",     label: "UKG",     bg: "#fffbeb", border: "#fbbf24", text: "#b45309", dot: "#f59e0b" },
  { value: "1",       label: "Class I",   bg: "#f0fdf4", border: "#4ade80", text: "#15803d", dot: "#22c55e" },
  { value: "2",       label: "Class II",  bg: "#ecfdf5", border: "#34d399", text: "#065f46", dot: "#10b981" },
  { value: "3",       label: "Class III", bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", dot: "#3b82f6" },
  { value: "4",       label: "Class IV",  bg: "#eef2ff", border: "#818cf8", text: "#3730a3", dot: "#6366f1" },
  { value: "5",       label: "Class V",   bg: "#faf5ff", border: "#c084fc", text: "#7e22ce", dot: "#a855f7" },
  { value: "6",       label: "Class VI",  bg: "#fdf2f8", border: "#f472b6", text: "#9d174d", dot: "#ec4899" },
  { value: "7",       label: "Class VII", bg: "#fff1f2", border: "#fb7185", text: "#be123c", dot: "#f43f5e" },
  { value: "8",       label: "Class VIII",bg: "#fff7ed", border: "#fdba74", text: "#9a3412", dot: "#fb923c" },
  { value: "9",       label: "Class IX",  bg: "#fefce8", border: "#fde047", text: "#854d0e", dot: "#eab308" },
  { value: "10",      label: "Class X",   bg: "#f0fdfa", border: "#2dd4bf", text: "#0f766e", dot: "#14b8a6" },
] as const;

export type ClassValue = (typeof CLASS_LIST)[number]["value"];

export function getClassConfig(value?: string | null) {
  return CLASS_LIST.find((c) => c.value === value) ?? null;
}

// ─── Badge pill shown in tables / cards ──────────────────────────────────────
export function ClassBadge({ value }: { value?: string | null }) {
  const cfg = getClassConfig(value);
  if (!cfg) return <span className="text-[12px] text-[var(--c-text-muted)]">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Selector grid shown in the Add/Edit student modal ───────────────────────
interface ClassSelectorProps {
  value: string;
  onChange: (v: string) => void;
}

export function ClassSelector({ value, onChange }: ClassSelectorProps) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-2">
        Class / Standard <span className="text-red-500">*</span>
      </label>

      {/* selected preview */}
      {value && (
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-[11.5px] text-[var(--c-text-muted)]">Selected:</span>
          <ClassBadge value={value} />
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
        {CLASS_LIST.map((cls) => {
          const active = value === cls.value;
          return (
            <button
              key={cls.value}
              type="button"
              onClick={() => onChange(cls.value)}
              className="relative flex flex-col items-center justify-center gap-0.5 rounded-[9px] px-1 py-2 text-[11px] font-bold transition-all cursor-pointer border-[1.5px]"
              style={{
                background: active ? cls.bg : "var(--c-surface)",
                borderColor: active ? cls.border : "var(--c-border)",
                color: active ? cls.text : "var(--c-text-secondary)",
                boxShadow: active ? `0 0 0 2px ${cls.border}44` : "none",
                transform: active ? "scale(1.06)" : "scale(1)",
              }}
            >
              {/* coloured dot */}
              <span
                className="w-2.5 h-2.5 rounded-full mb-0.5"
                style={{ background: cls.dot, opacity: active ? 1 : 0.45 }}
              />
              {cls.label.replace("Class ", "")}
              {active && (
                <span
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white"
                  style={{ background: cls.dot, fontSize: 8 }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!value && (
        <p className="mt-1.5 text-[11px] text-[var(--c-text-muted)]">
          Select a class to tag this student.
        </p>
      )}
    </div>
  );
}
