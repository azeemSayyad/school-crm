"use client";

import { getInitials, getHue } from "@/lib/utils";
import { STAGE_META, type Stage } from "@/lib/types";

/* ─── Badge ─── */
export function Badge({
  children,
  color,
  bg,
  className = "",
  style,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-[2px] rounded-[5px] tracking-[0.01em] leading-[18px] whitespace-nowrap ${className}`}
      style={{ color, background: bg, ...style }}
    >
      {children}
    </span>
  );
}

/* ─── Stage Badge ─── */
export function StageBadge({ stage }: { stage: Stage }) {
  const m = STAGE_META[stage];
  return (
    <Badge color={m.color} bg={m.bg}>
      <span className="mr-1 text-[7px] align-middle">{m.icon}</span>
      {stage}
    </Badge>
  );
}

/* ─── Avatar ─── */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = getHue(name);
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `hsl(${hue}, 45%, 55%)`,
      }}
    >
      <span
        className="text-white font-bold tracking-tight"
        style={{ fontSize: size * 0.38 }}
      >
        {getInitials(name)}
      </span>
    </div>
  );
}

/* ─── Input ─── */
export function Input({
  label,
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-[5px]">
      {label && (
        <label className="text-xs font-semibold text-[var(--c-text-secondary)]">
          {label}
        </label>
      )}
      <input
        {...props}
        className="px-[11px] py-2 border border-[var(--c-border)] rounded-[7px] text-[13px] font-[inherit] outline-none bg-[var(--c-surface)] text-[var(--c-text)] transition-all duration-150 focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px_var(--c-accent-ghost)]"
      />
    </div>
  );
}

/* ─── Select ─── */
export function Select({
  label,
  children,
  ...props
}: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-[5px]">
      {label && (
        <label className="text-xs font-semibold text-[var(--c-text-secondary)]">
          {label}
        </label>
      )}
      <select
        {...props}
        className="px-[11px] py-2 border border-[var(--c-border)] rounded-[7px] text-[13px] font-[inherit] outline-none bg-[var(--c-surface)] text-[var(--c-text)] cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

/* ─── Button ─── */
export function Btn({
  children,
  variant = "primary",
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-[7px] text-[13px] font-semibold cursor-pointer font-[inherit] transition-all duration-150 border-none";
  const v =
    variant === "primary"
      ? "bg-[var(--c-accent)] text-white"
      : "bg-[var(--c-surface)] text-[var(--c-text)] border border-[var(--c-border)]";
  return (
    <button {...props} className={`${base} ${v}`}>
      {children}
    </button>
  );
}

/* ─── Section Label ─── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)] mb-2.5 flex items-center gap-2">
      {children}
      <div className="flex-1 h-px bg-[var(--c-border)]" />
    </div>
  );
}
