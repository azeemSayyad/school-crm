"use client";

export const CLASS_LIST = [
  { value: "Nursery", label: "Nursery", bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "LKG",     label: "LKG",     bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "UKG",     label: "UKG",     bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "1",       label: "Class I",   bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "2",       label: "Class II",  bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "3",       label: "Class III", bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "4",       label: "Class IV",  bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "5",       label: "Class V",   bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "6",       label: "Class VI",  bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "7",       label: "Class VII", bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "8",       label: "Class VIII",bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "9",       label: "Class IX",  bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
  { value: "10",      label: "Class X",   bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#0170B9" },
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
