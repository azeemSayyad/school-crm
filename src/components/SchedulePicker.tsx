"use client";

import { useRef } from "react";

export type ScheduleMode = "now" | "later";

/** Convert a datetime-local input value (local time) to a UTC ISO string. */
export function pickerValueToUtcIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function SchedulePicker({
  mode,
  onModeChange,
  value,
  onValueChange,
  compact = false,
  disabled = false,
}: {
  mode: ScheduleMode;
  onModeChange: (mode: ScheduleMode) => void;
  value: string;
  onValueChange: (value: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex items-center gap-2 flex-wrap ${compact ? "text-[11.5px]" : "text-[13px]"}`}>
      {/* Send Now / Schedule toggle */}
      <div
        className="flex items-center rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--c-border)", background: "var(--c-bg)" }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange("now")}
          className="px-2.5 py-1 font-semibold border-none cursor-pointer transition-colors"
          style={{
            background: mode === "now" ? "var(--c-accent)" : "transparent",
            color: mode === "now" ? "#fff" : "var(--c-text-secondary)",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Now
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onModeChange("later");
            // Auto-focus the datetime input
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2.5 py-1 font-semibold border-none cursor-pointer transition-colors"
          style={{
            background: mode === "later" ? "var(--c-accent)" : "transparent",
            color: mode === "later" ? "#fff" : "var(--c-text-secondary)",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Schedule
        </button>
      </div>

      {/* Datetime input — shown only in "later" mode */}
      {mode === "later" && (
        <input
          ref={inputRef}
          type="datetime-local"
          min={minDateTime}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          className="px-2 py-1 rounded-lg border text-[inherit] outline-none focus:ring-2"
          style={{
            borderColor: "var(--c-border)",
            background: "var(--c-surface)",
            color: "var(--c-text)",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      )}
    </div>
  );
}
