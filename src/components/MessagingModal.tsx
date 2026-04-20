"use client";

/**
 * MessagingModal — quick-send modal for SMS / WhatsApp from a student context.
 *
 * Opens with one specific student already selected. Two channel buttons let the
 * user pick SMS (default) or WhatsApp; switching loads the matching conversation.
 * Templates from the text_templates table are available via a side popover with
 * full CRUD support.
 */

import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Message } from "@/lib/crm-types";
import { WA_TEMPLATES, pickTemplateLang, isWhatsAppWindowOpen, type WhatsAppTemplateLang } from "@/lib/whatsapp-templates";
import { SchedulePicker, pickerValueToUtcIso, type ScheduleMode } from "@/components/SchedulePicker";

interface StudentLite {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  language?: string | null;
}

interface TextTemplate {
  id: string;
  title: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

type Channel = "sms" | "whatsapp";

interface Props {
  student: StudentLite;
  initialChannel?: Channel;
  onClose: () => void;
}

const MSG_PAGE_SIZE = 200;
const SMS_SEGMENT_LIMIT = 160;

const CHANNEL_COLOR: Record<Channel, string> = {
  sms: "#7c3aed",
  whatsapp: "#25d366",
};

const getInitials = (n: string) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const getHue = (n: string) =>
  n.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const fmtDay = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
};

// Ordered list of variables exposed in the template editor. The `token` is
// the literal string inserted at the cursor; the label is what the user sees.
const TEMPLATE_VARIABLES: { token: string; label: string }[] = [
  { token: "{{name}}", label: "Name" },
  { token: "{{phone}}", label: "Phone" },
  { token: "{{email}}", label: "Email" },
  { token: "{{language}}", label: "Language" },
  { token: "{{shift}}", label: "Shift (AM/PM)" },
];

function applyTokens(text: string, student: StudentLite, shift?: string | null): string {
  if (!text) return "";
  const firstName = student.name?.split(" ")[0] ?? "";
  const lastName = student.name?.split(" ").slice(1).join(" ") ?? "";
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, student.name ?? "")
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
    .replace(/\{\{\s*phone\s*\}\}/gi, student.phone ?? "")
    .replace(/\{\{\s*email\s*\}\}/gi, student.email ?? "")
    .replace(/\{\{\s*language\s*\}\}/gi, student.language ?? "")
    .replace(/\{\{\s*shift\s*\}\}/gi, shift ?? "");
}

/* ───────────────────────────────────────────────────────── */
/* Status icon for outbound messages — matches inbox style:   */
/* always render ✓✓, recolor based on read/delivered.         */
/* Twilio status webhooks are unreliable (queued/failed often */
/* persist forever), so we don't surface granular states.    */
/* ───────────────────────────────────────────────────────── */

function StatusIcon({ status }: { status: Message["status"] }) {
  const isRead = status === "read" || status === "delivered";
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none" style={{ opacity: isRead ? 1 : 0.75 }}>
      <path d="M1 5.5l3 3L11 2" stroke={isRead ? "#7dd3fc" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5.5l3 3L15 2" stroke={isRead ? "#7dd3fc" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Templates Manager — overlay sub-modal with full CRUD      */
/* ───────────────────────────────────────────────────────── */

interface TemplatesManagerProps {
  templates: TextTemplate[];
  onPick: (tpl: TextTemplate) => void;
  onClose: () => void;
  onChange: () => Promise<void>;
}

function TemplatesManager({ templates, onPick, onClose, onChange }: TemplatesManagerProps) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<TextTemplate | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TextTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Variable insertion — chip clicks insert at cursor in whichever field was last focused.
  // Defaults to "description" so first click goes into the body (the common case).
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [focusedField, setFocusedField] = useState<"title" | "description">("description");

  const insertVariable = useCallback((token: string) => {
    if (focusedField === "title") {
      const el = titleInputRef.current;
      if (!el) return;
      const start = el.selectionStart ?? formTitle.length;
      const end = el.selectionEnd ?? formTitle.length;
      const next = formTitle.slice(0, start) + token + formTitle.slice(end);
      setFormTitle(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      const el = descriptionRef.current;
      if (!el) return;
      const start = el.selectionStart ?? formDescription.length;
      const end = el.selectionEnd ?? formDescription.length;
      const next = formDescription.slice(0, start) + token + formDescription.slice(end);
      setFormDescription(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    }
  }, [focusedField, formTitle, formDescription]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle("");
    setFormDescription("");
    setFormError(null);
    setView("form");
  };

  const openEdit = (tpl: TextTemplate) => {
    setEditing(tpl);
    setFormTitle(tpl.title);
    setFormDescription(tpl.description);
    setFormError(null);
    setView("form");
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!formDescription.trim()) {
      setFormError("Message is required");
      return;
    }
    if (!isSupabaseConfigured()) return;

    setSaving(true);
    setFormError(null);

    try {
      if (editing) {
        const { error } = await supabase
          .from("text_templates")
          .update({
            title: formTitle.trim(),
            description: formDescription,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from("text_templates")
          .insert({ title: formTitle.trim(), description: formDescription });
        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }
      }

      await onChange();
      setView("list");
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete || !isSupabaseConfigured()) return;
    setDeleting(true);
    const { error } = await supabase
      .from("text_templates")
      .delete()
      .eq("id", confirmDelete.id);
    if (!error) {
      await onChange();
      setConfirmDelete(null);
    }
    setDeleting(false);
  };

  const filtered = search.trim()
    ? templates.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      )
    : templates;

  return (
    <>
      <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm" onClick={() => !saving && !deleting && onClose()} />
      <div
        className="fixed z-[401] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] max-w-[95vw] h-[78vh] max-h-[760px] rounded-2xl shadow-[0_24px_72px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
        style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--c-accent-ghost)", color: "var(--c-accent)" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold text-[var(--c-text)] tracking-tight">Message templates</h3>
              <p className="text-[11.5px] text-[var(--c-text-muted)] mt-0.5">
                {view === "list"
                  ? `${templates.length} template${templates.length !== 1 ? "s" : ""} · click to insert`
                  : editing ? "Edit template" : "Create new template"}
              </p>
            </div>
          </div>
          <button
            onClick={() => !saving && !deleting && onClose()}
            disabled={saving || deleting}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer hover:bg-[var(--c-bg)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
            style={{ background: "transparent", color: "var(--c-text-muted)" }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {view === "list" ? (
          <>
            {/* Search + New */}
            <div className="flex items-center gap-2 px-6 py-3 shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
              <div className="flex-1 relative">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 transition-shadow"
                  style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text)" }}
                />
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold cursor-pointer border-none transition-opacity hover:opacity-90 shrink-0"
                style={{ background: "var(--c-accent)", color: "#fff" }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                New
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--c-bg)", color: "var(--c-text-muted)" }}>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--c-text)]">
                    {search ? "No templates match your search" : "No templates yet"}
                  </div>
                  <div className="text-[11.5px] text-[var(--c-text-muted)] mt-1">
                    {search ? "Try a different search term" : "Create your first template to get started"}
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  {filtered.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-start gap-3 px-6 py-3.5 cursor-pointer transition-colors hover:bg-[var(--c-bg)] border-b border-[var(--c-border-light)]"
                      onClick={() => onPick(t)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[var(--c-text)] mb-1 truncate">{t.title}</div>
                        <div className="text-[12px] text-[var(--c-text-muted)] line-clamp-2 whitespace-pre-wrap leading-relaxed">{t.description}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                          title="Edit"
                          className="w-7 h-7 rounded-md flex items-center justify-center border-none cursor-pointer transition-colors hover:bg-[var(--c-surface)]"
                          style={{ background: "transparent", color: "var(--c-text-secondary)" }}
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }}
                          title="Delete"
                          className="w-7 h-7 rounded-md flex items-center justify-center border-none cursor-pointer transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                          style={{ background: "transparent", color: "#ef4444" }}
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Form view */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider block mb-1.5">Title</label>
                <input
                  ref={titleInputRef}
                  autoFocus
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  onFocus={() => setFocusedField("title")}
                  placeholder="e.g. Welcome Message - Spanish"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 transition-shadow"
                  style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text)" }}
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-[11px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider block mb-1.5">Message</label>
                <textarea
                  ref={descriptionRef}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  onFocus={() => setFocusedField("description")}
                  placeholder="Write the message body. Click a variable below to insert a placeholder."
                  rows={10}
                  className="flex-1 w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none focus:ring-2 focus:ring-[var(--c-accent)]/20 transition-shadow leading-relaxed"
                  style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text)" }}
                />
                <div className="mt-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--c-text-muted)] mb-1.5">
                    Insert variable · will fill in the {focusedField === "title" ? "title" : "message"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onMouseDown={(e) => e.preventDefault() /* keep focus on the field */}
                        onClick={() => insertVariable(v.token)}
                        title={`Insert ${v.token}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-semibold cursor-pointer transition-colors hover:bg-[var(--c-accent)]/10"
                        style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)", fontFamily: "inherit" }}
                      >
                        <span>{v.label}</span>
                        <code className="text-[10.5px] opacity-70" style={{ color: "var(--c-accent)" }}>{v.token}</code>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {formError && (
                <div className="px-3 py-2 rounded-lg text-[12px] font-medium" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                  {formError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--c-border)", background: "var(--c-bg-subtle, var(--c-bg))" }}>
              <button
                onClick={() => { setView("list"); setEditing(null); setFormError(null); }}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
                style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formDescription.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-bold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--c-accent)", color: "#fff" }}
              >
                {saving && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                    <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {saving ? "Saving..." : editing ? "Save changes" : "Create template"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-[410] bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="fixed z-[411] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[95vw] rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#fef2f2", color: "#dc2626" }}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" /></svg>
                </div>
                <h3 className="text-[15px] font-extrabold text-[var(--c-text)] tracking-tight">Delete template?</h3>
              </div>
              <p className="text-[13px] text-[var(--c-text-secondary)] leading-relaxed">
                <span className="font-semibold text-[var(--c-text)]">{confirmDelete.title}</span> will be permanently removed. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--c-border)" }}>
              <button
                onClick={() => !deleting && setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
                style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-bold cursor-pointer border-none transition-opacity disabled:opacity-50"
                style={{ background: "#dc2626", color: "#fff" }}
              >
                {deleting && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                    <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Main MessagingModal                                        */
/* ───────────────────────────────────────────────────────── */

export default function MessagingModal({ student, initialChannel = "sms", onClose }: Props) {
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlderMsgs, setHasOlderMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const isPrependingRef = useRef(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const [shift, setShift] = useState<string | null>(null);

  const [templateLang, setTemplateLang] = useState<WhatsAppTemplateLang>(() => pickTemplateLang(student.language));
  const [prevStudentLang, setPrevStudentLang] = useState<string | null | undefined>(student.language);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("now");
  const [scheduleValue, setScheduleValue] = useState("");
  if (prevStudentLang !== student.language) {
    setPrevStudentLang(student.language);
    setTemplateLang(pickTemplateLang(student.language));
  }

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef(channel);
  useEffect(() => { channelRef.current = channel; }, [channel]);

  // Tracks outbound message bodies that this modal has just sent. The
  // realtime INSERT handler skips events that match a pending body so we
  // never double-add (POST response handler is the source of truth for
  // messages this modal sent).
  const pendingOutboundRef = useRef<Set<string>>(new Set());

  /* ─── Load templates (re-fetched on CRUD changes) ─── */
  const loadTemplates = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase
      .from("text_templates")
      .select("id, title, description, created_at, updated_at")
      .order("title");
    setTemplates((data as TextTemplate[]) || []);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  /* ─── Load student shift for template tokens ─── */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("shift")
        .eq("id", student.id)
        .single();
      setShift((data as { shift: string | null } | null)?.shift ?? null);
    })();
  }, [student.id]);

  /* ─── Load messages whenever the channel changes ─── */
  const loadMessages = useCallback(async (older = false) => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    if (older) setLoadingOlder(true); else setLoading(true);

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("channel", channel);
    const total = count || 0;

    const offset = older ? messages.length : 0;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("student_id", student.id)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .range(offset, offset + MSG_PAGE_SIZE - 1);
    const fetched = ((data as Message[]) || []).reverse();
    if (older) {
      isPrependingRef.current = true;
      setMessages((prev) => [...fetched, ...prev]);
    } else {
      setMessages(fetched);
    }
    setHasOlderMsgs(offset + MSG_PAGE_SIZE < total);
    setLoading(false);
    setLoadingOlder(false);

    if (!older) {
      supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("student_id", student.id)
        .eq("channel", channel)
        .eq("direction", "inbound")
        .is("read_at", null)
        .then();
    }
  }, [student.id, channel, messages.length]);

  useEffect(() => { loadMessages(false); }, [student.id, channel]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Auto-scroll to bottom on new messages (skip on older-prepend) ─── */
  useEffect(() => {
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ─── Auto-grow composer textarea ─── */
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const next = Math.min(ta.scrollHeight, 180);
    ta.style.height = `${next}px`;
  }, [text]);

  /* ─── Realtime ─── */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sub = supabase
      .channel(`messaging-modal-${student.id}-${Date.now()}`)
      .on(
        "postgres_changes" as "system",
        { event: "INSERT", schema: "public", table: "messages" } as Record<string, string>,
        (payload: { new: Message }) => {
          const m = payload.new as Message;
          if (!m || m.student_id !== student.id || m.channel !== channelRef.current) return;

          // Outbound INSERTs from this modal's own sends are owned by the POST
          // response handler. Drop the realtime event entirely if we're tracking
          // a pending send for this body — prevents the brief duplicate flash.
          if (m.direction === "outbound" && pendingOutboundRef.current.has(m.body)) {
            return;
          }

          setMessages((prev) => {
            // Already have the real row — nothing to do
            if (prev.some((x) => x.id === m.id)) return prev;
            // Match by twilio_sid if both sides have one
            if (m.twilio_sid && prev.some((x) => x.twilio_sid && x.twilio_sid === m.twilio_sid)) return prev;
            return [...prev, m];
          });
          if (m.direction === "inbound") {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then();
          }
        }
      )
      .on(
        "postgres_changes" as "system",
        { event: "UPDATE", schema: "public", table: "messages" } as Record<string, string>,
        (payload: { new: Message }) => {
          const m = payload.new as Message;
          if (!m?.id || m.student_id !== student.id) return;
          setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, status: m.status } : x));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [student.id]);

  /* ─── WhatsApp 24-hour window + template preview ─── */
  const whatsappWindowOpen = useMemo(() => isWhatsAppWindowOpen(messages), [messages]);
  // Teachers can toggle into template mode even when the 24h window is open.
  const [useTemplateMode, setUseTemplateMode] = useState(false);
  const showTemplatePicker = channel === "whatsapp" && (!whatsappWindowOpen || useTemplateMode);
  const templatePreview = useMemo(() => {
    const tpl = WA_TEMPLATES[templateLang];
    const firstName = (student.name || "there").split(" ")[0] || "there";
    return tpl.render(firstName);
  }, [templateLang, student.name]);

  const handleSendTemplate = async () => {
    if (sendingTemplate) return;
    const tpl = WA_TEMPLATES[templateLang];
    const firstName = (student.name || "there").split(" ")[0] || "there";
    const preview = tpl.render(firstName);

    // Schedule-later branch for WhatsApp template.
    if (scheduleMode === "later") {
      if (!scheduleValue) { setError("Pick a date and time"); return; }
      setSendingTemplate(true);
      setError(null);
      try {
        const res = await fetch("/api/scheduled-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "whatsapp",
            scheduled_at: pickerValueToUtcIso(scheduleValue),
            student_ids: [student.id],
            content_sid: tpl.sid,
            content_variables: { "1": firstName },
            user_id: user?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to schedule"); setSendingTemplate(false); return; }
        setScheduleMode("now");
        setScheduleValue("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule");
      }
      setSendingTemplate(false);
      return;
    }

    setSendingTemplate(true);
    setError(null);
    pendingOutboundRef.current.add(preview);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      student_id: student.id,
      created_at: new Date().toISOString(),
      direction: "outbound",
      channel: "whatsapp",
      body: preview,
      template_name: templateLang === "ES" ? "inquiry_es" : "inquiry_en",
      status: "queued",
      twilio_sid: null,
      from_number: null,
      to_number: student.phone,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, content_sid: tpl.sid, user_id: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(data.error || "Failed to send template");
        setSendingTemplate(false);
        pendingOutboundRef.current.delete(preview);
        return;
      }
      const savedMsg = (data as { message?: Message }).message;
      if (savedMsg) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? savedMsg : m));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(err instanceof Error ? err.message : "Failed to send template");
    }
    setSendingTemplate(false);
    setTimeout(() => pendingOutboundRef.current.delete(preview), 5000);
  };

  /* ─── Send ─── */
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Schedule-later branch: post to /api/scheduled-messages and return.
    if (scheduleMode === "later") {
      if (!scheduleValue) { setError("Pick a date and time"); return; }
      // WhatsApp scheduling requires a template (not free-form body).
      if (channel === "whatsapp") {
        setError("WhatsApp scheduling is template-only — use the template picker");
        return;
      }
      setSending(true);
      setError(null);
      try {
        const res = await fetch("/api/scheduled-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            scheduled_at: pickerValueToUtcIso(scheduleValue),
            student_ids: [student.id],
            body: trimmed,
            user_id: user?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to schedule"); setSending(false); return; }
        setText("");
        setScheduleMode("now");
        setScheduleValue("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule");
      }
      setSending(false);
      return;
    }

    setSending(true);
    setError(null);

    // Mark this body as a pending outbound send so the realtime handler
    // ignores the matching INSERT event and lets the POST response handler
    // own the state update.
    pendingOutboundRef.current.add(trimmed);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      student_id: student.id,
      created_at: new Date().toISOString(),
      direction: "outbound",
      channel,
      body: trimmed,
      template_name: null,
      status: "queued",
      twilio_sid: null,
      from_number: null,
      to_number: student.phone,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");

    try {
      const endpoint = channel === "sms" ? "/api/sms/send" : "/api/whatsapp/send";
      const userId = user?.id;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, message: trimmed, user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(data.error || "Failed to send");
        setText(trimmed);
        setSending(false);
        pendingOutboundRef.current.delete(trimmed);
        return;
      }
      const savedMsg = (data as { message?: Message }).message;
      if (savedMsg) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? savedMsg : m));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(err instanceof Error ? err.message : "Failed to send");
      setText(trimmed);
    }
    setSending(false);
    // Keep the pending marker for a short window in case realtime arrives
    // after the POST response (rare but possible). Clear after 5 seconds.
    setTimeout(() => {
      pendingOutboundRef.current.delete(trimmed);
    }, 5000);
  };

  const pickTemplate = (tpl: TextTemplate) => {
    const replaced = applyTokens(tpl.description, student, shift);
    setText(replaced);
    setTemplatesOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  const charCount = text.length;
  const segments = channel === "sms" ? Math.max(1, Math.ceil(charCount / SMS_SEGMENT_LIMIT)) : 0;

  // Group messages by day
  const groupedMessages: { date: string; items: Message[] }[] = [];
  for (const m of messages) {
    const day = fmtDay(m.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === day) {
      last.items.push(m);
    } else {
      groupedMessages.push({ date: day, items: [m] });
    }
  }

  const hue = getHue(student.name);
  const accent = CHANNEL_COLOR[channel];
  const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS";

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="fixed z-[301] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[880px] max-w-[95vw] h-[85vh] max-h-[820px] rounded-2xl shadow-[0_24px_72px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
        style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 55%), hsl(${(hue + 30) % 360}, 60%, 45%))` }}
              >
                {getInitials(student.name)}
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                style={{ background: accent, borderColor: "var(--c-surface)" }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold text-[var(--c-text)] truncate tracking-tight">{student.name}</div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--c-text-muted)] mt-0.5">
                <span>{student.phone}</span>
                <span className="opacity-50">·</span>
                <span style={{ color: accent }} className="font-semibold">{channelLabel}</span>
              </div>
            </div>
          </div>

          {/* Channel selector — segmented control */}
          <div
            className="flex items-center p-1 rounded-xl shrink-0"
            style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)" }}
          >
            <button
              onClick={() => setChannel("sms")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer border-none transition-all"
              style={{
                background: channel === "sms" ? CHANNEL_COLOR.sms : "transparent",
                color: channel === "sms" ? "#fff" : "var(--c-text-muted)",
                boxShadow: channel === "sms" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              SMS
            </button>
            <button
              onClick={() => setChannel("whatsapp")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer border-none transition-all"
              style={{
                background: channel === "whatsapp" ? CHANNEL_COLOR.whatsapp : "transparent",
                color: channel === "whatsapp" ? "#fff" : "var(--c-text-muted)",
                boxShadow: channel === "whatsapp" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
              </svg>
              WhatsApp
            </button>
          </div>

          <button
            onClick={handleClose}
            disabled={sending}
            className="w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer hover:bg-[var(--c-bg)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
            style={{ background: "transparent", color: "var(--c-text-muted)" }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ─── Conversation area ─── */}
        <div
          className="flex-1 overflow-y-auto px-8 py-5"
          style={{
            background: "var(--c-bg)",
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--c-border-light) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="var(--c-border)" strokeWidth="3" />
                <path d="M12 2a10 10 0 019.75 7.75" stroke={accent} strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", color: accent }}
              >
                {channel === "whatsapp" ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                  </svg>
                ) : (
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                )}
              </div>
              <div className="text-[14px] font-bold text-[var(--c-text)]">No {channelLabel} messages yet</div>
              <div className="text-[12.5px] text-[var(--c-text-muted)] mt-1">Send the first one to start the conversation.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-w-[760px] mx-auto">
              {hasOlderMsgs && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={() => loadMessages(true)}
                    disabled={loadingOlder}
                    className="px-4 py-1.5 rounded-full text-[11px] font-semibold border-none cursor-pointer shadow-sm"
                    style={{ background: "var(--c-surface)", color: "var(--c-text-muted)", border: "1px solid var(--c-border)" }}
                  >
                    {loadingOlder ? "Loading..." : "Load older messages"}
                  </button>
                </div>
              )}
              {groupedMessages.map((group) => (
                <div key={group.date} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-center my-3">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-1 rounded-full"
                      style={{ background: "var(--c-surface)", color: "var(--c-text-muted)", border: "1px solid var(--c-border)" }}
                    >
                      {group.date}
                    </span>
                  </div>
                  {group.items.map((m, idx) => {
                    const outbound = m.direction === "outbound";
                    const prev = group.items[idx - 1];
                    const isGrouped = prev && prev.direction === m.direction && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000);
                    return (
                      <div
                        key={m.id}
                        className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                        style={{ marginTop: isGrouped ? 2 : 6 }}
                      >
                        <div
                          className="max-w-[68%] px-3.5 py-2 text-[13px] leading-snug whitespace-pre-wrap break-words shadow-sm"
                          style={{
                            background: outbound ? accent : "var(--c-surface)",
                            color: outbound ? "#fff" : "var(--c-text)",
                            border: outbound ? "none" : "1px solid var(--c-border)",
                            borderRadius: outbound
                              ? `18px 18px ${isGrouped ? "18px" : "4px"} 18px`
                              : `18px 18px 18px ${isGrouped ? "18px" : "4px"}`,
                          }}
                        >
                          <div>{m.body}</div>
                          <div
                            className={`flex items-center gap-1 mt-1 text-[10.5px] ${outbound ? "justify-end" : "justify-start"}`}
                            style={{ color: outbound ? "rgba(255,255,255,0.85)" : "var(--c-text-muted)" }}
                          >
                            <span>{fmtTime(m.created_at)}</span>
                            {outbound && <StatusIcon status={m.status} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-6 py-2.5 text-[12px] font-semibold flex items-center gap-2 shrink-0" style={{ background: "#fef2f2", borderTop: "1px solid #fecaca", color: "#991b1b" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100 cursor-pointer border-none bg-transparent" style={{ color: "inherit" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* ─── Composer ─── */}
        {showTemplatePicker ? (
          <div className="shrink-0 px-6 py-4" style={{ background: "var(--c-surface)", borderTop: "1px solid var(--c-border)" }}>
            <div className="flex flex-col gap-3 rounded-2xl p-3.5" style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)" }}>
              <div className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: "var(--c-text-muted)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>
                  {whatsappWindowOpen
                    ? "Sending an approved template."
                    : "24-hour window closed — send an approved template to start the conversation."}
                </span>
                {whatsappWindowOpen && (
                  <button
                    onClick={() => setUseTemplateMode(false)}
                    className="ml-auto px-2.5 py-1 rounded-md text-[10.5px] font-bold cursor-pointer border-none"
                    style={{ background: "var(--c-surface)", color: CHANNEL_COLOR.whatsapp, border: `1px solid ${CHANNEL_COLOR.whatsapp}` }}
                    title="Back to free chat"
                  >
                    ← Back to chat
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center p-[3px] rounded-lg shrink-0" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                  {(["EN", "ES"] as WhatsAppTemplateLang[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setTemplateLang(lang)}
                      className="px-3 py-1.5 rounded-md text-[11.5px] font-bold cursor-pointer border-none transition-all"
                      style={{
                        background: templateLang === lang ? CHANNEL_COLOR.whatsapp : "transparent",
                        color: templateLang === lang ? "#fff" : "var(--c-text-muted)",
                      }}
                    >
                      {lang === "EN" ? "English" : "Español"}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-muted)" }}>
                  {WA_TEMPLATES[templateLang].label}
                </span>
              </div>
              <div className="px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text)" }}>
                {templatePreview}
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <SchedulePicker
                  mode={scheduleMode}
                  onModeChange={setScheduleMode}
                  value={scheduleValue}
                  onValueChange={setScheduleValue}
                  compact
                  disabled={sendingTemplate}
                />
                <button
                  onClick={handleSendTemplate}
                  disabled={sendingTemplate || (scheduleMode === "later" && !scheduleValue)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: CHANNEL_COLOR.whatsapp, color: "#fff" }}
                >
                  {sendingTemplate ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  )}
                  {sendingTemplate ? (scheduleMode === "later" ? "Scheduling..." : "Sending...") : (scheduleMode === "later" ? "Schedule template" : "Send template")}
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="shrink-0 px-6 py-4" style={{ background: "var(--c-surface)", borderTop: "1px solid var(--c-border)" }}>
          <div
            className="rounded-2xl transition-shadow"
            style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)" }}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Send ${channelLabel} message to ${student.name.split(" ")[0]}...`}
              rows={1}
              className="w-full px-4 py-3 bg-transparent text-[13.5px] outline-none resize-none placeholder:text-[var(--c-text-muted)] leading-relaxed"
              style={{ color: "var(--c-text)", minHeight: 44 }}
            />
            <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderTop: "1px solid var(--c-border-light)" }}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTemplatesOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold cursor-pointer border-none transition-colors hover:bg-[var(--c-surface)]"
                  style={{ background: "transparent", color: "var(--c-text-secondary)" }}
                  title="Open saved snippets"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                  Snippets
                  {templates.length > 0 && (
                    <span className="text-[10px] font-bold opacity-60">{templates.length}</span>
                  )}
                </button>
                {channel === "whatsapp" && (
                  <button
                    onClick={() => setUseTemplateMode(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold cursor-pointer border-none transition-colors hover:bg-[var(--c-surface)]"
                    style={{ background: "transparent", color: "var(--c-text-secondary)" }}
                    title="Send an approved WhatsApp template"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <line x1="8" y1="9" x2="16" y2="9" />
                      <line x1="8" y1="13" x2="16" y2="13" />
                      <line x1="8" y1="17" x2="12" y2="17" />
                    </svg>
                    WA Template
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {channel === "sms" && charCount > 0 && (
                  <span className="text-[11px] font-medium text-[var(--c-text-muted)]">
                    {charCount}/{SMS_SEGMENT_LIMIT * segments} · {segments} segment{segments !== 1 ? "s" : ""}
                  </span>
                )}
                <SchedulePicker
                  mode={scheduleMode}
                  onModeChange={setScheduleMode}
                  value={scheduleValue}
                  onValueChange={setScheduleValue}
                  compact
                  disabled={sending}
                />
                {scheduleMode === "now" && (
                  <span className="text-[10.5px] text-[var(--c-text-muted)] hidden sm:inline">⌘ + Enter</span>
                )}
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending || (scheduleMode === "later" && !scheduleValue)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: accent, color: "#fff" }}
                  title={scheduleMode === "later" ? "Schedule" : "Send (⌘ + Enter)"}
                >
                  {sending ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                  {sending ? (scheduleMode === "later" ? "Scheduling..." : "Sending...") : (scheduleMode === "later" ? "Schedule" : "Send")}
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {templatesOpen && (
        <TemplatesManager
          templates={templates}
          onPick={pickTemplate}
          onClose={() => setTemplatesOpen(false)}
          onChange={loadTemplates}
        />
      )}
    </>
  );
}
