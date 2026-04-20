"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Student, Message } from "@/lib/crm-types";
import { LEAD_CLASSIFICATIONS, ACTIVE_LEAD_STATUSES, PIPELINE_STATUSES, DATA_SOURCES } from "@/lib/crm-types";
import type { DataSource } from "@/lib/crm-types";
import {
  getTemplate,
  pickTemplateLang,
  isWhatsAppWindowOpen,
  type WhatsAppTemplateLang,
  type WhatsAppTemplateCategory,
} from "@/lib/whatsapp-templates";
import { SchedulePicker, pickerValueToUtcIso, type ScheduleMode } from "@/components/SchedulePicker";
import RichTextEditor from "@/components/RichTextEditor";

interface EmailTplOption { id: string; title: string; subject: string; body: string; }
interface ScheduledMessage { id: string; channel: string; body?: string | null; subject?: string | null; scheduled_at: string; content_sid?: string | null; content_variables?: Record<string, string> | null; }

/* ─── Helpers ─── */
const getInitials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const getHue = (n: string) => n.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "now"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };
const formatTime = (d: string) => { const dt = new Date(d); const now = new Date(); if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); return dt.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const formatMiamiShort = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const plainTextToHtml = (text: string) => text.split("\n").map((l) => `<p>${l || "&nbsp;"}</p>`).join("");

interface ConversationPreview { student: Student; lastMessage: string; lastMessageAt: string; unreadCount: number; }


export default function InboxPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showClassify, setShowClassify] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);
  const [sendChannel, setSendChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [contactSearching, setStudentSearching] = useState(false);
  const [newChatStatus, setNewChatStatus] = useState<string>("");
  const [newChatStatusOpen, setNewChatStatusOpen] = useState(false);
  const [directStudent, setDirectStudent] = useState<Student | null>(null);
  const [msgPage, setMsgPage] = useState(0);
  const [hasOlderMsgs, setHasOlderMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const MSG_PAGE_SIZE = 20;


  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastStatuses, setBroadcastStatuses] = useState<Set<string>>(new Set());
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastRecipients, setBroadcastRecipients] = useState<{ id: string; name: string; phone: string; email: string | null; language: string | null }[]>([]);
  const [broadcastSelected, setBroadcastSelected] = useState<Set<string>>(new Set());
  const [broadcastSearchAdded, setBroadcastSearchAdded] = useState<Set<string>>(new Set());
  const [broadcastVisibleCount, setBroadcastVisibleCount] = useState(10);
  const [broadcastLoadingRecipients, setBroadcastLoadingRecipients] = useState(false);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [broadcastDone, setBroadcastDone] = useState(false);
  const [broadcastFailures, setBroadcastFailures] = useState<{ name: string; reason: string }[]>([]);
  const [broadcastChannel, setBroadcastChannel] = useState<"whatsapp" | "sms" | "email">("sms");
  const [broadcastSearch, setBroadcastSearch] = useState("");
  const [broadcastSearchFocused, setBroadcastSearchFocused] = useState(false);
  const [broadcastSearchResults, setBroadcastSearchResults] = useState<{ id: string; name: string; phone: string; email: string | null; language: string | null }[]>([]);
  const [broadcastSearchLoading, setBroadcastSearchLoading] = useState(false);
  // Lead creation date range filter
  const [broadcastDateFrom, setBroadcastDateFrom] = useState("");
  const [broadcastDateTo, setBroadcastDateTo] = useState("");
  const [broadcastSources, setBroadcastSources] = useState<Set<DataSource>>(new Set());
  const [broadcastShift, setBroadcastShift] = useState<"" | "AM" | "PM">("");
  const [broadcastWaCategory, setBroadcastWaCategory] = useState<"" | WhatsAppTemplateCategory>("");
  const [broadcastWaLang, setBroadcastWaLang] = useState<"auto" | WhatsAppTemplateLang>("auto");
  const [broadcastScheduleMode, setBroadcastScheduleMode] = useState<ScheduleMode>("now");
  const [broadcastScheduleValue, setBroadcastScheduleValue] = useState("");
  const [broadcastEmailSubject, setBroadcastEmailSubject] = useState("");
  const [broadcastEmailBody, setBroadcastEmailBody] = useState("");
  const [broadcastEmailTemplateId, setBroadcastEmailTemplateId] = useState("");
  const [broadcastEmailTemplates, setBroadcastEmailTemplates] = useState<EmailTplOption[]>([]);
  const [broadcastProgram, setBroadcastProgram] = useState("all");
  const [broadcastProgramStatuses, setBroadcastProgramStatuses] = useState<Set<string>>(new Set());
  const [broadcastCampaignName, setBroadcastCampaignName] = useState("");

  // Inbox tab + scheduled messages state
  const [inboxView, setInboxView] = useState<"chats" | "scheduled">("chats");
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledItems, setScheduledItems] = useState<ScheduledMessage[]>([]);
  const [scheduledEditId, setScheduledEditId] = useState<string | null>(null);
  const [scheduledEditBody, setScheduledEditBody] = useState("");
  const [scheduledEditSubject, setScheduledEditSubject] = useState("");
  const [scheduledEditAt, setScheduledEditAt] = useState("");
  const [scheduledSaving, setScheduledSaving] = useState(false);
  const [scheduledCancelId, setScheduledCancelId] = useState<string | null>(null);

  // WhatsApp template chat state
  const [useTemplateMode, setUseTemplateMode] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<WhatsAppTemplateCategory>("inquiry");
  const [templateLang, setTemplateLang] = useState<WhatsAppTemplateLang>("EN");
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [programName, setProgramName] = useState<string | undefined>(undefined);
  const [chatScheduleMode, setChatScheduleMode] = useState<ScheduleMode>("now");
  const [chatScheduleValue, setChatScheduleValue] = useState("");

  const selectedStudent = conversations.find((c) => c.student.id === selectedStudentId)?.student || (directStudent?.id === selectedStudentId ? directStudent : null);

  // WhatsApp 24-hour window: open if any inbound WhatsApp msg in last 24h
  const whatsappWindowOpen = useMemo(() => isWhatsAppWindowOpen(messages), [messages]);
  // Show template picker when window is closed (required) OR when user has toggled
  // into template mode explicitly inside an open window.
  const showTemplatePicker = sendChannel === "whatsapp" && (!whatsappWindowOpen || useTemplateMode);

  const templatePreview = useMemo(() => {
    const tpl = getTemplate(templateCategory, templateLang);
    const firstName = (selectedStudent?.name || "there").split(" ")[0] || "there";
    return tpl.render({ name: firstName, program: programName || tpl.fallback?.program || "" });
  }, [templateCategory, templateLang, selectedStudent, programName]);



  useEffect(() => { const cid = searchParams.get("student"); if (cid) selectStudentById(cid); }, [searchParams]); // eslint-disable-line
  const selectStudentById = async (cid: string) => { const ex = conversations.find((c) => c.student.id === cid); if (ex) { setSelectedStudentId(cid); return; } if (!isSupabaseConfigured()) return; const { data } = await supabase.from("students").select("*").eq("id", cid).single(); if (data) { setDirectStudent(data as Student); setSelectedStudentId(cid); } };

  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const { data: msgs } = await supabase.from("messages").select("student_id, body, created_at, direction, read_at").order("created_at", { ascending: false });
    if (!msgs || msgs.length === 0) { setConversations([]); setLoading(false); return; }
    const cm = new Map<string, { lastMessage: string; lastMessageAt: string; unreadCount: number }>();
    for (const m of msgs) {
      if (!cm.has(m.student_id)) cm.set(m.student_id, { lastMessage: m.body, lastMessageAt: m.created_at, unreadCount: 0 });
      // Only count inbound messages with no read_at as unread
      if (m.direction === "inbound" && !m.read_at) cm.get(m.student_id)!.unreadCount++;
    }
    const ids = Array.from(cm.keys());
    const { data: students } = await supabase.from("students").select("*").in("id", ids);
    if (!students) { setLoading(false); return; }
    const p: ConversationPreview[] = students.map((c) => { const i = cm.get(c.id); return i ? { student: c as Student, ...i } : null; }).filter(Boolean) as ConversationPreview[];
    p.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(p); setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (cid: string, older = false) => {
    if (!isSupabaseConfigured()) return;
    if (older) setLoadingOlder(true); else setMessagesLoading(true);

    // Get total count first to know if there are older messages
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("student_id", cid);
    const total = count || 0;

    // Load the latest MSG_PAGE_SIZE messages (or older ones)
    const offset = older ? messages.length : 0;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("student_id", cid)
      .order("created_at", { ascending: false })
      .range(offset, offset + MSG_PAGE_SIZE - 1);

    const fetched = ((data as Message[]) || []).reverse();
    if (older) {
      setMessages((prev) => [...fetched, ...prev]);
    } else {
      setMessages(fetched);
    }
    setHasOlderMsgs(offset + MSG_PAGE_SIZE < total);
    setMessagesLoading(false);
    setLoadingOlder(false);
  }, [messages.length]);

  useEffect(() => {
    if (!selectedStudentId) return;
    setMsgPage(0);
    loadMessages(selectedStudentId);
    // Mark all inbound messages as read for this student
    if (isSupabaseConfigured()) {
      supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("student_id", selectedStudentId)
        .eq("direction", "inbound")
        .is("read_at", null)
        .then(() => { loadConversations(); });
    }
  }, [selectedStudentId, loadMessages, loadConversations]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ─── Supabase Realtime: smooth append, no reload ───
  const selectedStudentIdRef = useRef(selectedStudentId);
  const conversationsRef = useRef(conversations);
  useEffect(() => { selectedStudentIdRef.current = selectedStudentId; }, [selectedStudentId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes" as "system",
        { event: "INSERT", schema: "public", table: "messages" } as Record<string, string>,
        (payload: { new: Message }) => {
          const newMsg = payload.new as Message;
          if (!newMsg?.student_id) return;

          // Append to current chat if it belongs to the open conversation
          if (newMsg.student_id === selectedStudentIdRef.current) {
            // Skip outbound messages we already added optimistically
            if (newMsg.direction === "outbound" && pendingOutboundRef.current.has(newMsg.body)) {
              // Replace temp message with the real one from DB
              setMessages((prev) => {
                const tempIdx = prev.findIndex((m) => m.id.startsWith("temp-") && m.body === newMsg.body);
                if (tempIdx !== -1) {
                  const updated = [...prev];
                  updated[tempIdx] = newMsg;
                  return updated;
                }
                return prev;
              });
              return;
            }
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id || (m.twilio_sid && m.twilio_sid === newMsg.twilio_sid))) return prev;
              return [...prev, newMsg];
            });
            // Mark inbound as read immediately since chat is open
            if (newMsg.direction === "inbound" && isSupabaseConfigured()) {
              supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", newMsg.id).then();
            }
          }

          // Update sidebar: bump this student to top with new last message
          setConversations((prev) => {
            const existing = prev.find((c) => c.student.id === newMsg.student_id);
            if (existing) {
              const updated = prev.map((c) =>
                c.student.id === newMsg.student_id
                  ? {
                      ...c,
                      lastMessage: newMsg.body,
                      lastMessageAt: newMsg.created_at,
                      unreadCount: newMsg.direction === "inbound" && newMsg.student_id !== selectedStudentIdRef.current
                        ? c.unreadCount + 1
                        : c.unreadCount,
                    }
                  : c
              );
              updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
              return updated;
            }
            // New student not in sidebar — do a full reload once
            loadConversations();
            return prev;
          });
        }
      )
      .on(
        "postgres_changes" as "system",
        { event: "UPDATE", schema: "public", table: "messages" } as Record<string, string>,
        (payload: { new: Message }) => {
          const updated = payload.new as Message;
          if (!updated?.id) return;
          // Update just this message's status in place — no reload
          if (updated.student_id === selectedStudentIdRef.current) {
            setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, status: updated.status } : m));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

  // ─── Optimistic send: append immediately, no reload ───
  const pendingOutboundRef = useRef<Set<string>>(new Set());
  const handleSend = async () => {
    if (!messageInput.trim() || !selectedStudentId) return;
    const msg = messageInput.trim();

    setMessageInput("");
    // Reset textarea height
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    inputRef.current?.focus();

    // Optimistic: add message to UI instantly
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      student_id: selectedStudentId,
      created_at: new Date().toISOString(),
      direction: "outbound",
      channel: sendChannel,
      body: msg,
      template_name: null,
      status: "queued",
      twilio_sid: null,
      from_number: null,
      to_number: null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    pendingOutboundRef.current.add(msg);

    // Update sidebar optimistically
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.student.id === selectedStudentId ? { ...c, lastMessage: msg, lastMessageAt: optimisticMsg.created_at } : c
      );
      updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      return updated;
    });

    // Fire-and-forget API call — UI is already updated
    const endpoint = sendChannel === "sms" ? "/api/sms/send" : "/api/whatsapp/send";
    const userId = user?.id;
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: selectedStudentId, message: msg, user_id: userId }) });
      if (r.ok) {
        // Mark optimistic message as sent
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "sent" } : m));
      } else {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setToast({ message: "Failed to send message", color: "#e74c3c" });
        setTimeout(() => setToast(null), 5000);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setToast({ message: "Failed to send message", color: "#e74c3c" });
      setTimeout(() => setToast(null), 5000);
    } finally {
      // Clear pending marker after a delay to prevent realtime duplicates
      setTimeout(() => pendingOutboundRef.current.delete(msg), 5000);
    }
  };

  const handleSendTemplate = async () => {
    if (!selectedStudentId || !selectedStudent || sendingTemplate) return;
    const tpl = getTemplate(templateCategory, templateLang);
    const firstName = (selectedStudent.name || "there").split(" ")[0] || "there";
    const programForTpl = programName || tpl.fallback?.program || "";

    const preview = tpl.render({
      name: firstName,
      program: programForTpl,
    });

    // Build Twilio's numeric contentVariables ("1", "2", ...) from ordered slots.
    const orderedContentVariables: Record<string, string> = {};
    tpl.variables.forEach((slot, i) => {
      const value =
        slot === "name" ? firstName :
        slot === "program" ? programForTpl :
        "";
      orderedContentVariables[String(i + 1)] = value;
    });

    if (chatScheduleMode === "later") {
      if (!chatScheduleValue) { setToast({ message: "Pick a date and time", color: "#ef4444" }); setTimeout(() => setToast(null), 4000); return; }
      setSendingTemplate(true);
      try {
        const r = await fetch("/api/scheduled-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "whatsapp",
            scheduled_at: pickerValueToUtcIso(chatScheduleValue),
            student_ids: [selectedStudentId],
            content_sid: tpl.sid,
            content_variables: orderedContentVariables,
            user_id: user?.id,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          setToast({ message: data.error || "Failed to schedule", color: "#ef4444" });
          setTimeout(() => setToast(null), 4000);
        } else {
          setChatScheduleMode("now");
          setChatScheduleValue("");
          setToast({ message: `${tpl.label} scheduled`, color: "#008069" });
          setTimeout(() => setToast(null), 3000);
        }
      } catch {
        setToast({ message: "Failed to schedule", color: "#ef4444" });
        setTimeout(() => setToast(null), 4000);
      }
      setSendingTemplate(false);
      return;
    }

    setSendingTemplate(true);
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      student_id: selectedStudentId,
      created_at: new Date().toISOString(),
      direction: "outbound",
      channel: "whatsapp",
      body: preview,
      template_name: `${tpl.category}_${tpl.lang.toLowerCase()}`,
      status: "queued",
      twilio_sid: null,
      from_number: null,
      to_number: null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    pendingOutboundRef.current.add(preview);

    // Update sidebar preview optimistically
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.student.id === selectedStudentId ? { ...c, lastMessage: preview, lastMessageAt: optimisticMsg.created_at } : c
      );
      updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      return updated;
    });

    try {
      const r = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          content_sid: tpl.sid,
          user_id: user?.id,
        }),
      });
      if (r.ok) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "sent" } : m));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setToast({ message: "Failed to send template", color: "#e74c3c" });
        setTimeout(() => setToast(null), 5000);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setToast({ message: "Failed to send template", color: "#e74c3c" });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSendingTemplate(false);
      setTimeout(() => pendingOutboundRef.current.delete(preview), 5000);
    }
  };

  const CLASSIFY_TOAST: Record<string, { message: string; color: string }> = { ready_to_sign_up: { message: "Marked as Ready to Sign Up — enrollment SMS sent", color: "#008069" }, ready_to_book: { message: "Marked as Ready to Book — scheduling SMS sent", color: "#1d8348" }, interested_follow_up: { message: "Marked as Interested — follow-up SMS scheduled in 24hrs", color: "#b7950b" }, not_interested: { message: "Marked as Not Interested — all follow-ups cancelled", color: "#667781" } };
  const handleClassify = async (cls: string) => {
    if (!selectedStudentId || classifying) return;
    setClassifying(true);
    setShowClassify(false);
    try {
      const r = await fetch("/api/leads/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudentId, classification: cls }),
      });
      if (r.ok) {
        const i = CLASSIFY_TOAST[cls];
        if (i) {
          setToast(i);
          setTimeout(() => setToast(null), 5000);
        }
      } else {
        setToast({ message: "Failed to classify", color: "#ef4444" });
        setTimeout(() => setToast(null), 5000);
      }
    } catch {
      setToast({ message: "Failed to classify", color: "#ef4444" });
      setTimeout(() => setToast(null), 5000);
    }
    await loadConversations();
    setClassifying(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  useEffect(() => {
    if (!showNewChat || !isSupabaseConfigured()) return;
    const f = async () => {
      setStudentSearching(true);
      const q = contactSearch.trim();
      let qr = supabase.from("students").select("*").order("name").limit(20);
      if (q) qr = qr.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
      if (newChatStatus) qr = qr.eq("pipeline_status", newChatStatus);
      const { data } = await qr;
      setStudentResults((data as Student[]) || []);
      setStudentSearching(false);
    };
    if (!contactSearch.trim() && !newChatStatus) { f(); return; }
    const t = setTimeout(f, 250);
    return () => clearTimeout(t);
  }, [contactSearch, showNewChat, newChatStatus]);
  const handleStartChat = (c: Student) => { setDirectStudent(c); setSelectedStudentId(c.id); setShowNewChat(false); setStudentSearch(""); setStudentResults([]); setNewChatStatus(""); setNewChatStatusOpen(false); loadConversations(); };
  const filtered = conversations.filter((c) => { if (!search) return true; const q = search.toLowerCase(); return c.student.name.toLowerCase().includes(q) || c.student.phone.includes(q) || (c.student.email || "").toLowerCase().includes(q); });

  // ─── Broadcast logic ───
  const openBroadcast = () => {
    setShowBroadcast(true);
    setBroadcastProgram("all");
    setBroadcastMsg("");
    setBroadcastDone(false);
    setBroadcastFailures([]);
    setBroadcastStatuses(new Set());
    setBroadcastChannel("sms");
    setBroadcastProgress({ sent: 0, failed: 0, total: 0 });
    setBroadcastSearch("");
    setBroadcastSearchFocused(false);
    setBroadcastEmailSubject("");
    setBroadcastEmailBody("");
    setBroadcastEmailTemplateId("");
    setBroadcastWaCategory("");
    setBroadcastWaLang("auto");
    setBroadcastDateFrom("");
    setBroadcastDateTo("");
    setBroadcastScheduleMode("now");
    setBroadcastScheduleValue("");
  };

  const closeBroadcast = () => {
    if (broadcastSending) return;
    setShowBroadcast(false);
    setBroadcastMsg("");
    setBroadcastRecipients([]);
    setBroadcastSelected(new Set());
    setBroadcastSearchAdded(new Set());
    setBroadcastVisibleCount(10);
    setBroadcastDone(false);
    setBroadcastFailures([]);
    setBroadcastStatuses(new Set());
    setBroadcastProgram("all");
    setBroadcastSearch("");
    setBroadcastSearchFocused(false);
    setBroadcastEmailSubject("");
    setBroadcastEmailBody("");
    setBroadcastEmailTemplateId("");
    setBroadcastWaCategory("");
    setBroadcastWaLang("auto");
    setBroadcastDateFrom("");
    setBroadcastDateTo("");
  };

  // Load email templates when the broadcast modal opens with email channel
  useEffect(() => {
    if (!showBroadcast || broadcastChannel !== "email" || !isSupabaseConfigured()) return;
    (async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("id, title, subject, body")
        .order("updated_at", { ascending: false })
        .limit(100);
      setBroadcastEmailTemplates(((data || []) as EmailTplOption[]));
    })();
  }, [showBroadcast, broadcastChannel]);

  // Load up to 100 matching students on broadcast open, and when audience/program/channel/date changes
  const BROADCAST_MAX_RECIPIENTS = 100;
  const broadcastSearchAddedRef = useRef<Set<string>>(broadcastSearchAdded);
  useEffect(() => { broadcastSearchAddedRef.current = broadcastSearchAdded; }, [broadcastSearchAdded]);
  useEffect(() => {
    if (!showBroadcast || !isSupabaseConfigured()) return;
    const load = async () => {
      setBroadcastLoadingRecipients(true);

      // Lead-status filter — empty set means "all statuses across both leads & students"
      const statuses: string[] = broadcastStatuses.size > 0
        ? Array.from(broadcastStatuses)
        : [...ACTIVE_LEAD_STATUSES, "Enrolled", "Inservice"];

      const isEmail = broadcastChannel === "email";

      // If program filter or program-status filter is set, get matching student IDs first
      let restrictIds: string[] | null = null;
      const hasProgramFilter = broadcastProgram !== "all";
      const hasProgramStatusFilter = broadcastProgramStatuses.size > 0;
      if (hasProgramFilter || hasProgramStatusFilter) {
        let pq = supabase.from("student_programs").select("student_id").limit(5000);
        if (hasProgramFilter) pq = pq.eq("program_name", broadcastProgram);
        if (hasProgramStatusFilter) pq = pq.in("program_status", Array.from(broadcastProgramStatuses));
        const { data: progData } = await pq;
        const progIds = Array.from(new Set((progData || []).map((p: { student_id: string }) => p.student_id)));
        if (progIds.length === 0) {
          const added = broadcastSearchAddedRef.current;
          setBroadcastRecipients((prev) => prev.filter((p) => added.has(p.id)));
          setBroadcastSelected((prev) => {
            const next = new Set<string>();
            for (const id of prev) if (added.has(id)) next.add(id);
            return next;
          });
          setBroadcastLoadingRecipients(false);
          return;
        }
        restrictIds = progIds;
      }

      const buildQuery = (includeOptOut: boolean) => {
        let q = supabase
          .from("students")
          .select(includeOptOut ? "id, name, phone, email, language, email_opt_out" : "id, name, phone, email, language")
          .in("pipeline_status", statuses)
          .order("name")
          .limit(BROADCAST_MAX_RECIPIENTS);
        if (isEmail) {
          q = q.not("email", "is", null).neq("email", "");
          if (includeOptOut) q = q.or("email_opt_out.is.null,email_opt_out.eq.false");
        } else {
          q = q.not("phone", "is", null);
        }
        if (restrictIds) q = q.in("id", restrictIds);
        if (broadcastDateFrom) q = q.gte("created_at", broadcastDateFrom);
        if (broadcastDateTo) q = q.lte("created_at", `${broadcastDateTo}T23:59:59.999Z`);
        if (broadcastSources.size > 0) q = q.in("data_source", Array.from(broadcastSources));
        if (broadcastShift) q = q.eq("shift", broadcastShift);
        return q;
      };

      let { data, error } = await buildQuery(true);
      // Fall back if the email_opt_out column doesn't exist yet (migration not run)
      if (error && /email_opt_out/.test(error.message || "")) {
        ({ data, error } = await buildQuery(false));
      }
      if (error) console.error("Broadcast recipients query failed:", error);

      const students = ((data || []) as unknown as { id: string; name: string; phone: string; email: string | null; language: string | null }[])
        .filter((c) => (isEmail ? !!c.email : !!c.phone))
        .map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, language: c.language ?? null, program: "—" }));

      // Fetch program names
      if (students.length > 0) {
        const ids = students.map((c) => c.id);
        const { data: progs } = await supabase.from("student_programs").select("student_id, program_name").in("student_id", ids);
        if (progs) {
          const programMap: Record<string, string> = {};
          for (const p of progs) {
            programMap[p.student_id] = programMap[p.student_id] ? programMap[p.student_id] + ", " + p.program_name : p.program_name;
          }
          for (const r of students) {
            if (programMap[r.id]) r.program = programMap[r.id];
          }
        }
      }

      // Preserve any students the user added via search across filter reloads
      // — switching channel/audience/program shouldn't wipe their explicit picks.
      const added = broadcastSearchAddedRef.current;
      setBroadcastRecipients((prev) => {
        const carryOver = prev.filter((p) => added.has(p.id));
        const seen = new Set(students.map((c) => c.id));
        const extras = carryOver.filter((c) => !seen.has(c.id));
        return [...students, ...extras];
      });
      setBroadcastSelected((prev) => {
        const next = new Set(students.map((r) => r.id));
        for (const id of added) next.add(id);
        for (const id of prev) if (added.has(id)) next.add(id);
        return next;
      });
      setBroadcastVisibleCount(10);
      setBroadcastLoadingRecipients(false);
    };
    load();
  }, [broadcastStatuses, broadcastProgram, broadcastChannel, broadcastDateFrom, broadcastDateTo, broadcastSources, broadcastProgramStatuses, broadcastShift, showBroadcast]);

  // Search students from DB when typing in broadcast search
  useEffect(() => {
    if (!showBroadcast || !isSupabaseConfigured() || !broadcastSearch.trim()) {
      setBroadcastSearchResults([]);
      return;
    }
    setBroadcastSearchLoading(true);
    const timer = setTimeout(async () => {
      const q = broadcastSearch.trim();
      const isEmail = broadcastChannel === "email";
      const buildSearchQuery = (includeOptOut: boolean) => {
        let sq = supabase
          .from("students")
          .select(includeOptOut ? "id, name, phone, email, language, email_opt_out" : "id, name, phone, email, language")
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
          .order("name")
          .limit(10);
        if (isEmail) {
          sq = sq.not("email", "is", null).neq("email", "");
          if (includeOptOut) sq = sq.or("email_opt_out.is.null,email_opt_out.eq.false");
        } else {
          sq = sq.not("phone", "is", null);
        }
        return sq;
      };
      let { data, error } = await buildSearchQuery(true);
      if (error && /email_opt_out/.test(error.message || "")) {
        ({ data, error } = await buildSearchQuery(false));
      }
      if (error) console.error("Broadcast search query failed:", error);
      const results = ((data || []) as unknown as { id: string; name: string; phone: string; email: string | null; language: string | null }[])
        .filter((c) => (isEmail ? !!c.email : !!c.phone))
        .map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, language: c.language ?? null, program: "—" }));

      // Fetch programs for results
      if (results.length > 0) {
        const ids = results.map((c) => c.id);
        const { data: progs } = await supabase.from("student_programs").select("student_id, program_name").in("student_id", ids);
        if (progs) {
          const programMap: Record<string, string> = {};
          for (const p of progs) {
            programMap[p.student_id] = programMap[p.student_id] ? programMap[p.student_id] + ", " + p.program_name : p.program_name;
          }
          for (const r of results) {
            if (programMap[r.id]) r.program = programMap[r.id];
          }
        }
      }

      setBroadcastSearchResults(results);
      setBroadcastSearchLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [broadcastSearch, showBroadcast, broadcastChannel]);

  const canSendBroadcast = useMemo(() => {
    if (broadcastSelected.size === 0 || broadcastSending || broadcastLoadingRecipients) return false;
    if (broadcastChannel === "email") {
      return !!broadcastEmailSubject.trim() && !!broadcastEmailBody.replace(/<[^>]*>/g, "").trim();
    }
    // SMS/WhatsApp: either a free-text message OR a template is required
    if (broadcastWaCategory) return true;
    return !!broadcastMsg.trim();
  }, [broadcastSelected.size, broadcastSending, broadcastLoadingRecipients, broadcastChannel, broadcastEmailSubject, broadcastEmailBody, broadcastMsg, broadcastWaCategory]);

  const handleBroadcastSend = async () => {
    const selectedRecipients = broadcastRecipients.filter((r) => broadcastSelected.has(r.id));
    if (selectedRecipients.length === 0 || broadcastSending) return;
    if (broadcastChannel === "email") {
      if (!broadcastEmailSubject.trim() || !broadcastEmailBody.replace(/<[^>]*>/g, "").trim()) return;
    } else if (!broadcastWaCategory && !broadcastMsg.trim()) {
      return;
    }

    // Schedule-later branch: one bulk POST with all student_ids under a single broadcast_id.
    if (broadcastScheduleMode === "later") {
      if (!broadcastScheduleValue) {
        setToast({ message: "Pick a date and time for the broadcast", color: "#ef4444" });
        setTimeout(() => setToast(null), 4000);
        return;
      }
      if (broadcastChannel === "whatsapp" && !broadcastWaCategory) {
        setToast({ message: "Pick a WhatsApp template to schedule", color: "#ef4444" });
        setTimeout(() => setToast(null), 4000);
        return;
      }
      setBroadcastSending(true);
      try {
        const scheduledAt = pickerValueToUtcIso(broadcastScheduleValue);
        const studentIds = selectedRecipients.map((r) => r.id);

        // WhatsApp scheduled broadcast: insert one row per recipient with resolved template variables.
        if (broadcastChannel === "whatsapp") {
          // Scheduled WhatsApp requires template — resolve "auto" per recipient.
          let lastError: string | null = null;
          const broadcastGroupId = (globalThis.crypto && "randomUUID" in globalThis.crypto)
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          for (const r of selectedRecipients) {
            const lang: WhatsAppTemplateLang = broadcastWaLang === "auto"
              ? pickTemplateLang(r.language)
              : broadcastWaLang;
            const tpl = getTemplate(broadcastWaCategory as WhatsAppTemplateCategory, lang);
            const firstName = (r.name || "").split(" ")[0] || "there";
            const primaryProgram = r.program && r.program !== "—" ? r.program.split(",")[0].trim() : "";
            const res = await fetch("/api/scheduled-messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channel: "whatsapp",
                scheduled_at: scheduledAt,
                student_ids: [r.id],
                content_sid: tpl.sid,
                content_variables: { "1": firstName, "2": primaryProgram || tpl.fallback?.program || "" },
                user_id: user?.id,
                is_broadcast: true,
                broadcast_id: broadcastGroupId,
              }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              lastError = data.error || `Failed (${res.status})`;
            }
          }
          if (lastError) {
            setToast({ message: `Some rows failed: ${lastError}`, color: "#ef4444" });
          } else {
            setToast({ message: `Scheduled ${studentIds.length} WhatsApp messages`, color: "#008069" });
          }
        } else {
          // SMS / email: single bulk insert.
          const payload: Record<string, unknown> = {
            channel: broadcastChannel,
            scheduled_at: scheduledAt,
            student_ids: studentIds,
            user_id: user?.id,
            is_broadcast: studentIds.length > 1,
          };
          if (broadcastChannel === "email") {
            payload.subject = broadcastEmailSubject.trim();
            payload.body = broadcastEmailBody;
          } else {
            payload.body = broadcastMsg.trim();
          }
          const res = await fetch("/api/scheduled-messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            setToast({ message: data.error || "Failed to schedule", color: "#ef4444" });
          } else {
            setToast({ message: `Scheduled ${studentIds.length} ${broadcastChannel === "email" ? "emails" : "messages"}`, color: "#008069" });
          }
        }
        setTimeout(() => setToast(null), 3500);
      } catch (err) {
        setToast({ message: err instanceof Error ? err.message : "Failed to schedule", color: "#ef4444" });
        setTimeout(() => setToast(null), 4000);
      }
      setBroadcastSending(false);
      setBroadcastDone(true);
      return;
    }

    setBroadcastSending(true);
    setBroadcastDone(false);
    setBroadcastFailures([]);
    const total = selectedRecipients.length;
    setBroadcastProgress({ sent: 0, failed: 0, total });
    const failures: { name: string; reason: string }[] = [];

    let sent = 0;
    let failed = 0;

    const broadcastUserId = user?.id;

    if (broadcastChannel === "email") {
      // SendGrid campaign — single API call, SendGrid handles delivery
      try {
        const campaignName = broadcastCampaignName.trim() || `Broadcast ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
        const sgFilter: Record<string, unknown> = {};
        if (broadcastStatuses.size > 0) sgFilter.pipeline_statuses = Array.from(broadcastStatuses);
        if (broadcastSources.size > 0) sgFilter.data_sources = Array.from(broadcastSources);
        if (broadcastProgram !== "all") sgFilter.program_names = [broadcastProgram];
        if (broadcastProgramStatuses.size > 0) sgFilter.program_statuses = Array.from(broadcastProgramStatuses);
        if (broadcastShift) sgFilter.shift = broadcastShift;
        if (broadcastDateFrom) sgFilter.created_after = broadcastDateFrom;
        if (broadcastDateTo) sgFilter.created_before = broadcastDateTo;

        const isScheduled = broadcastScheduleMode !== "now" && !!broadcastScheduleValue;
        const payload: Record<string, unknown> = {
          name: campaignName,
          subject: broadcastEmailSubject.trim(),
          body: broadcastEmailBody,
          filter: sgFilter,
          send_now: !isScheduled,
          user_id: broadcastUserId,
        };
        if (isScheduled) payload.schedule_at = pickerValueToUtcIso(broadcastScheduleValue);

        const res = await fetch("/api/sendgrid/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          sent = data.recipient_count || total;
          setBroadcastProgress({ sent, failed: 0, total: sent });
        } else {
          failed = total;
          failures.push({ name: "Campaign", reason: data.error || `HTTP ${res.status}` });
          setBroadcastProgress({ sent: 0, failed, total });
        }
      } catch (err) {
        failed = total;
        failures.push({ name: "Campaign", reason: err instanceof Error ? err.message : "network error" });
        setBroadcastProgress({ sent: 0, failed, total });
      }
    } else {
      const endpoint = broadcastChannel === "sms" ? "/api/sms/send" : "/api/whatsapp/send";
      const useTemplate = !!broadcastWaCategory;
      for (const r of selectedRecipients) {
        try {
          const firstName = (r.name || "").split(" ")[0] || "there";
          const primaryProgram = r.program && r.program !== "—" ? r.program.split(",")[0].trim() : "";

          // Resolve template lang per recipient if "auto"
          const lang: WhatsAppTemplateLang | null = useTemplate
            ? (broadcastWaLang === "auto" ? pickTemplateLang(r.language) : broadcastWaLang)
            : null;

          let payload: Record<string, unknown>;
          if (lang && broadcastChannel === "whatsapp") {
            // WhatsApp: use Twilio Content Template SID. Pass variables explicitly
            // so the API doesn't have to fall back to per-student DB lookups —
            // this matches what the inbox does and removes a silent-fail path
            // for students with no contact_programs row.
            const tpl = getTemplate(broadcastWaCategory as WhatsAppTemplateCategory, lang);
            payload = {
              student_id: r.id,
              content_sid: tpl.sid,
              variables: {
                name: firstName,
                program: primaryProgram || tpl.fallback?.program || "",
              },
              user_id: broadcastUserId,
            };
          } else if (lang && broadcastChannel === "sms") {
            // SMS: render the template locally into plain text
            const tpl = getTemplate(broadcastWaCategory as WhatsAppTemplateCategory, lang);
            const renderedMessage = tpl.render({
              name: firstName,
              program: primaryProgram || tpl.fallback?.program || "",
            });
            payload = { student_id: r.id, message: renderedMessage, user_id: broadcastUserId };
          } else {
            // Plain text for both channels
            payload = { student_id: r.id, message: broadcastMsg.trim(), user_id: broadcastUserId };
          }

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            sent++;
          } else {
            failed++;
            const data = await res.json().catch(() => ({}));
            failures.push({ name: r.name, reason: data.error || `HTTP ${res.status}` });
          }
        } catch (err) {
          failed++;
          failures.push({ name: r.name, reason: err instanceof Error ? err.message : "network error" });
        }
        setBroadcastProgress({ sent, failed, total });
      }
    }

    setBroadcastFailures(failures);
    setBroadcastSending(false);
    setBroadcastDone(true);
  };

  /* ─── Scheduled messages ─── */
  const loadScheduled = useCallback(async () => {
    setScheduledLoading(true);
    try {
      const r = await fetch("/api/scheduled-messages?status=pending&limit=200");
      const data = await r.json();
      setScheduledItems(data.items || []);
    } catch {
      setScheduledItems([]);
    }
    setScheduledLoading(false);
  }, []);

  useEffect(() => {
    if (inboxView === "scheduled") loadScheduled();
  }, [inboxView, loadScheduled]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openScheduledEdit = (m: ScheduledMessage & { student?: any }) => {
    setScheduledEditId(m.id);
    setScheduledEditBody(m.body || "");
    setScheduledEditSubject(m.subject || "");
    // Convert stored UTC back into datetime-local Miami time
    setScheduledEditAt((() => {
      const d = new Date(m.scheduled_at);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
      const hour = get("hour") === "24" ? "00" : get("hour");
      return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
    })());
  };

  const saveScheduledEdit = async () => {
    if (!scheduledEditId) return;
    setScheduledSaving(true);
    try {
      const payload: Record<string, unknown> = {
        scheduled_at: pickerValueToUtcIso(scheduledEditAt),
      };
      // Match the existing channel of the message to decide what fields to send.
      const existing = scheduledItems.find((x) => x.id === scheduledEditId);
      if (existing) {
        if (existing.channel === "email") {
          payload.subject = scheduledEditSubject;
          payload.body = scheduledEditBody;
        } else if (existing.channel === "sms") {
          payload.body = scheduledEditBody;
        }
      }
      const r = await fetch(`/api/scheduled-messages/${scheduledEditId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        setToast({ message: data.error || "Failed to save", color: "#ef4444" });
        setTimeout(() => setToast(null), 4000);
      } else {
        setScheduledEditId(null);
        await loadScheduled();
      }
    } catch {
      setToast({ message: "Failed to save", color: "#ef4444" });
      setTimeout(() => setToast(null), 4000);
    }
    setScheduledSaving(false);
  };

  const confirmScheduledCancel = async () => {
    if (!scheduledCancelId) return;
    setScheduledSaving(true);
    try {
      const r = await fetch(`/api/scheduled-messages/${scheduledCancelId}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setToast({ message: data.error || "Failed to cancel", color: "#ef4444" });
        setTimeout(() => setToast(null), 4000);
      } else {
        setScheduledCancelId(null);
        await loadScheduled();
      }
    } catch {
      setToast({ message: "Failed to cancel", color: "#ef4444" });
      setTimeout(() => setToast(null), 4000);
    }
    setScheduledSaving(false);
  };


  return (
    <div className="flex h-full relative" style={{ background: "#eae6df" }}>

      {/* ─── LEFT: Sidebar ─── */}
      <div className={`flex flex-col shrink-0 ${selectedStudentId ? "hidden md:flex" : "flex"} w-full md:w-[300px] lg:w-[360px]`} style={{ background: "#fff", borderRight: "1px solid #e9edef" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2" style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
          <span className="text-[15px] font-semibold" style={{ color: "#111b21" }}>Inbox</span>
          <div className="flex items-center gap-1.5">
            <button onClick={openBroadcast} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer border-none transition-all" style={{ background: "#e7fce3", color: "#008069" }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2a6 6 0 010-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 010 8.4" /><path d="M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2" /></svg>
              Broadcast
            </button>
            <button onClick={() => setShowNewChat(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer border-none transition-all" style={{ background: "#00a884", color: "#fff" }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              New Chat
            </button>
          </div>
        </div>

        {/* Tabs: Chats / Scheduled */}
        <div className="flex items-center gap-1 px-2 pt-1.5 pb-1" style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
          {(["chats", "scheduled"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setInboxView(v)}
              className="flex-1 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer border-none transition-colors"
              style={{
                background: inboxView === v ? "#e7fce3" : "transparent",
                color: inboxView === v ? "#008069" : "#667781",
              }}
            >
              {v === "chats" ? "Chats" : `Scheduled${scheduledItems.length ? ` · ${scheduledItems.length}` : ""}`}
            </button>
          ))}
        </div>

        {inboxView === "chats" ? (
          <>
            {/* Search */}
            <div className="px-2 py-1.5" style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                <input type="text" placeholder="Search or start new chat" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg text-[13px] outline-none placeholder:text-[#8696a0]" style={{ background: "#f0f2f5", border: "none", color: "#111b21" }} />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="#e9edef" strokeWidth="3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="#00a884" strokeWidth="3" strokeLinecap="round" /></svg></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-1">
                  <span className="text-[13px]" style={{ color: "#8696a0" }}>No conversations yet</span>
                  <span className="text-[11px]" style={{ color: "#b0b6bc" }}>Start a new chat to begin</span>
                </div>
              ) : (
                filtered.map((conv) => {
                  const isActive = conv.student.id === selectedStudentId;
                  const hue = getHue(conv.student.name);
                  return (
                    <button key={conv.student.id} onClick={() => setSelectedStudentId(conv.student.id)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left border-none cursor-pointer transition-all"
                      style={{ background: isActive ? "#f0f2f5" : "#fff", borderBottom: "1px solid #f5f6f6" }}>
                      <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold text-white"
                        style={{ background: `hsl(${hue}, 45%, 55%)` }}>
                        {getInitials(conv.student.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] truncate" style={{ color: "#111b21" }}>{conv.student.name}</span>
                          <span className="text-[11px] shrink-0 ml-2" style={{ color: conv.unreadCount > 0 ? "#25d366" : "#8696a0" }}>{timeAgo(conv.lastMessageAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[12px] truncate flex-1" style={{ color: "#667781" }}>{conv.lastMessage}</span>
                          {conv.unreadCount > 0 && (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#25d366" }}>{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto">
            {scheduledLoading ? (
              <div className="flex items-center justify-center py-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="#e9edef" strokeWidth="3" />
                  <path d="M12 2a10 10 0 019.75 7.75" stroke="#00a884" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ) : scheduledItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-1 px-6 text-center">
                <span className="text-[13px]" style={{ color: "#8696a0" }}>No scheduled messages</span>
                <span className="text-[11px]" style={{ color: "#b0b6bc" }}>Schedule one from a chat, broadcast, or email composer</span>
              </div>
            ) : (
              scheduledItems.map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const c = (m as any).student as { id: string; name: string; phone: string; email: string | null } | null;
                const channelColor = m.channel === "whatsapp" ? "#25d366" : m.channel === "email" ? "#0170B9" : "#7c3aed";
                return (
                  <div key={m.id} className="px-3 py-2.5 flex flex-col gap-1" style={{ borderBottom: "1px solid #f5f6f6" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate" style={{ color: "#111b21" }}>{c?.name || "Unknown student"}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${channelColor}1a`, color: channelColor }}>{m.channel}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "#008069" }}>{formatMiamiShort(m.scheduled_at)}</div>
                    {m.channel === "whatsapp" ? (
                      <div className="text-[12px] italic" style={{ color: "#667781" }}>
                        Template · {m.content_variables?.["1"] ? `Hi ${m.content_variables["1"]}` : "Inquiry"}
                      </div>
                    ) : (
                      <div className="text-[12px] line-clamp-2" style={{ color: "#667781" }}>
                        {m.channel === "email" && m.subject ? <span className="font-semibold">{m.subject}: </span> : null}
                        {(m.body || "").replace(/<[^>]*>/g, "").slice(0, 120)}
                      </div>
                    )}
                    <div className="flex gap-1.5 mt-0.5">
                      {m.channel !== "whatsapp" && (
                        <button
                          onClick={() => openScheduledEdit(m)}
                          className="flex-1 py-1 rounded text-[11px] font-semibold cursor-pointer border-none"
                          style={{ background: "#e7fce3", color: "#008069" }}
                        >
                          Edit
                        </button>
                      )}
                      {m.channel === "whatsapp" && (
                        <button
                          onClick={() => openScheduledEdit(m)}
                          className="flex-1 py-1 rounded text-[11px] font-semibold cursor-pointer border-none"
                          style={{ background: "#e7fce3", color: "#008069" }}
                        >
                          Reschedule
                        </button>
                      )}
                      <button
                        onClick={() => setScheduledCancelId(m.id)}
                        className="flex-1 py-1 rounded text-[11px] font-semibold cursor-pointer border-none"
                        style={{ background: "#fee2e2", color: "#b91c1c" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ─── BROADCAST MODAL ─── */}
      {showBroadcast && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/25 backdrop-blur-sm" onClick={closeBroadcast} />
          <div className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1300px] max-w-[95vw] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: "#fff", maxHeight: "92vh" }}>
            {/* Header */}
            <div className="px-6 py-5" style={{ background: "#008069" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2a6 6 0 010-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 010 8.4" /><path d="M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2" /></svg>
                  <h3 className="text-[18px] font-semibold text-white">Broadcast Message</h3>
                </div>
                <button onClick={closeBroadcast} disabled={broadcastSending} className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", opacity: broadcastSending ? 0.3 : 1 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-[13px] text-white/70">
                {broadcastChannel === "email" ? "Send an email to multiple students at once" : "Send a message to multiple students at once"}
              </p>
            </div>

            {/* Body */}
            {broadcastDone ? (
              /* ─── Success State ─── full-width centered ─── */
              <div className="flex-1 overflow-auto px-6 py-8">
                <div className="flex flex-col items-center max-w-[520px] mx-auto">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: broadcastProgress.failed === 0 ? "#d9fdd3" : "#fff3cd" }}>
                    {broadcastProgress.failed === 0 ? (
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#008069" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#856404" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                    )}
                  </div>
                  <h4 className="text-[18px] font-semibold mb-1" style={{ color: "#111b21" }}>Broadcast Complete</h4>
                  <p className="text-[14px] mb-4" style={{ color: "#667781" }}>
                    Sent to <strong style={{ color: "#008069" }}>{broadcastProgress.sent}</strong> student{broadcastProgress.sent !== 1 ? "s" : ""}
                    {broadcastProgress.failed > 0 && <>, <strong style={{ color: "#e74c3c" }}>{broadcastProgress.failed}</strong> failed</>}
                  </p>
                  {broadcastFailures.length > 0 && (
                    <div className="w-full mb-5 rounded-xl overflow-hidden" style={{ background: "#fff8f8", border: "1px solid #fecaca" }}>
                      <div className="px-4 py-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#991b1b", background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                        Failures
                      </div>
                      <div className="max-h-[220px] overflow-auto">
                        {broadcastFailures.map((f, i) => (
                          <div key={i} className="px-4 py-2 text-[12.5px]" style={{ borderTop: i === 0 ? "none" : "1px solid #fecaca" }}>
                            <div className="font-semibold" style={{ color: "#7f1d1d" }}>{f.name}</div>
                            <div className="font-mono text-[11.5px] mt-0.5" style={{ color: "#991b1b" }}>{f.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={closeBroadcast} className="px-6 py-2.5 rounded-full text-[14px] font-semibold cursor-pointer border-none" style={{ background: "#008069", color: "#fff" }}>Done</button>
                </div>
              </div>
            ) : (
              <>
                {/* Channel toggle — full-width strip above the 2-col body */}
                <div className="px-5 md:px-6 py-3.5 shrink-0 flex flex-wrap items-center gap-2" style={{ background: "#f8fafc", borderBottom: "1px solid #e9edef" }}>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider mr-1" style={{ color: "#8696a0" }}>Channel</span>
                  <button onClick={() => setBroadcastChannel("sms")} disabled={broadcastSending}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-semibold cursor-pointer transition-all border-none"
                    style={{ background: broadcastChannel === "sms" ? "#0170B9" : "#fff", color: broadcastChannel === "sms" ? "#fff" : "#54656f", border: broadcastChannel === "sms" ? "1px solid #0170B9" : "1px solid #e9edef", boxShadow: broadcastChannel === "sms" ? "0 2px 6px rgba(1,112,185,0.25)" : "none" }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    SMS
                  </button>
                  <button onClick={() => setBroadcastChannel("whatsapp")} disabled={broadcastSending}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-semibold cursor-pointer transition-all border-none"
                    style={{ background: broadcastChannel === "whatsapp" ? "#25d366" : "#fff", color: broadcastChannel === "whatsapp" ? "#fff" : "#54656f", border: broadcastChannel === "whatsapp" ? "1px solid #25d366" : "1px solid #e9edef", boxShadow: broadcastChannel === "whatsapp" ? "0 2px 6px rgba(37,211,102,0.25)" : "none" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    WhatsApp
                  </button>
                  <button onClick={() => setBroadcastChannel("email")} disabled={broadcastSending}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-semibold cursor-pointer transition-all border-none"
                    style={{ background: broadcastChannel === "email" ? "#ea4335" : "#fff", color: broadcastChannel === "email" ? "#fff" : "#54656f", border: broadcastChannel === "email" ? "1px solid #ea4335" : "1px solid #e9edef", boxShadow: broadcastChannel === "email" ? "0 2px 6px rgba(234,67,53,0.25)" : "none" }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    Email
                  </button>
                  <div className="flex-1" />
                  <span className="text-[11.5px]" style={{ color: "#8696a0" }}>
                    <strong style={{ color: "#008069" }}>{broadcastSelected.size}</strong> recipient{broadcastSelected.size !== 1 ? "s" : ""} selected
                  </span>
                </div>

                {/* Two-column body — stacks on mobile, side-by-side on lg+ */}
                <div className="flex-1 lg:overflow-hidden overflow-auto flex flex-col lg:flex-row min-h-0">
                  {/* ─── LEFT: Audience ─── */}
                  <div className="lg:w-[55%] lg:overflow-y-auto px-5 md:px-6 py-5" style={{ borderRight: "1px solid #e9edef" }}>
                    <div className="mb-5">
                      <h4 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#111b21", letterSpacing: "0.06em" }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-[10px]" style={{ background: "#008069", color: "#fff" }}>1</span>
                        Audience
                      </h4>
                      <p className="text-[11.5px] mt-1 ml-7" style={{ color: "#8696a0" }}>Filter and pick who receives this broadcast</p>
                    </div>

                    {/* Lead-status multi-select */}
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11.5px] font-semibold uppercase tracking-wider block" style={{ color: "#54656f" }}>
                        Lead Status {broadcastStatuses.size > 0 && <span className="ml-1 normal-case font-normal" style={{ color: "#008069" }}>({broadcastStatuses.size})</span>}
                      </label>
                      {broadcastStatuses.size > 0 && (
                        <button onClick={() => setBroadcastStatuses(new Set())} disabled={broadcastSending}
                          className="text-[11px] font-semibold cursor-pointer border-none bg-transparent" style={{ color: "#667781" }}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {PIPELINE_STATUSES.map((s) => {
                        const isActive = broadcastStatuses.has(s.value);
                        return (
                          <button
                            key={s.value}
                            onClick={() => {
                              setBroadcastStatuses((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.value)) next.delete(s.value);
                                else next.add(s.value);
                                return next;
                              });
                            }}
                            disabled={broadcastSending}
                            className="px-2.5 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-all"
                            style={{
                              background: isActive ? s.color : s.bg,
                              color: isActive ? "#fff" : s.color,
                              border: `1px solid ${isActive ? s.color : s.bg}`,
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Program filter */}
                    <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Program</label>
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {BROADCAST_PROGRAMS.map((prog) => {
                        const isActive = broadcastProgram === prog;
                        const label = prog === "all" ? "All Programs" : prog;
                        return (
                          <button key={prog} onClick={() => setBroadcastProgram(prog)} disabled={broadcastSending}
                            className="px-3 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-all"
                            style={{
                              background: isActive ? "#0170B9" : "#f0f2f5",
                              color: isActive ? "#fff" : "#111b21",
                              border: `1px solid ${isActive ? "#0170B9" : "#f0f2f5"}`,
                            }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Date range */}
                    <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Lead Created</label>
                    <div className="flex flex-wrap items-end gap-2 mb-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] mb-1" style={{ color: "#8696a0" }}>From</span>
                        <input type="date" value={broadcastDateFrom} max={broadcastDateTo || undefined} onChange={(e) => setBroadcastDateFrom(e.target.value)} disabled={broadcastSending}
                          className="px-3 py-1.5 rounded-lg text-[13px] outline-none"
                          style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] mb-1" style={{ color: "#8696a0" }}>To</span>
                        <input type="date" value={broadcastDateTo} min={broadcastDateFrom || undefined} onChange={(e) => setBroadcastDateTo(e.target.value)} disabled={broadcastSending}
                          className="px-3 py-1.5 rounded-lg text-[13px] outline-none"
                          style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }} />
                      </div>
                      {(broadcastDateFrom || broadcastDateTo) && (
                        <button onClick={() => { setBroadcastDateFrom(""); setBroadcastDateTo(""); }} disabled={broadcastSending}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer border-none"
                          style={{ background: "#f0f2f5", color: "#667781" }}>
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Extra filters (Source, Program Status, Shift) */}
                        {/* Source */}
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[11.5px] font-semibold uppercase tracking-wider block" style={{ color: "#54656f" }}>
                            Source {broadcastSources.size > 0 && <span className="ml-1 normal-case font-normal" style={{ color: "#008069" }}>({broadcastSources.size})</span>}
                          </label>
                          {broadcastSources.size > 0 && (
                            <button onClick={() => setBroadcastSources(new Set())} disabled={broadcastSending}
                              className="text-[11px] font-semibold cursor-pointer border-none bg-transparent" style={{ color: "#667781" }}>Clear</button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {DATA_SOURCES.map((s) => {
                            const isActive = broadcastSources.has(s.value);
                            return (
                              <button key={s.value} onClick={() => {
                                setBroadcastSources((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s.value)) next.delete(s.value); else next.add(s.value);
                                  return next;
                                });
                              }} disabled={broadcastSending}
                                className="px-2.5 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-all"
                                style={{ background: isActive ? s.color : s.bg, color: isActive ? "#fff" : s.color, border: `1px solid ${isActive ? s.color : s.bg}` }}>
                                {s.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Program Status */}
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[11.5px] font-semibold uppercase tracking-wider block" style={{ color: "#54656f" }}>
                            Program Status {broadcastProgramStatuses.size > 0 && <span className="ml-1 normal-case font-normal" style={{ color: "#008069" }}>({broadcastProgramStatuses.size})</span>}
                          </label>
                          {broadcastProgramStatuses.size > 0 && (
                            <button onClick={() => setBroadcastProgramStatuses(new Set())} disabled={broadcastSending}
                              className="text-[11px] font-semibold cursor-pointer border-none bg-transparent" style={{ color: "#667781" }}>Clear</button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {(["active", "completed", "withdrawn"] as const).map((s) => {
                            const isActive = broadcastProgramStatuses.has(s);
                            const clr = s === "active" ? "#10b981" : s === "completed" ? "#0f766e" : "#f59e0b";
                            const bg = s === "active" ? "#ecfdf5" : s === "completed" ? "#ccfbf1" : "#fffbeb";
                            return (
                              <button key={s} onClick={() => {
                                setBroadcastProgramStatuses((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s)) next.delete(s); else next.add(s);
                                  return next;
                                });
                              }} disabled={broadcastSending}
                                className="px-2.5 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-all"
                                style={{ background: isActive ? clr : bg, color: isActive ? "#fff" : clr, border: `1px solid ${isActive ? clr : bg}` }}>
                                {s}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[10px] mb-5" style={{ color: "#8696a0", fontStyle: "italic" }}>completed = alumni</div>

                        {/* Shift */}
                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Shift</label>
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {(["AM", "PM"] as const).map((s) => {
                            const isActive = broadcastShift === s;
                            return (
                              <button key={s} onClick={() => setBroadcastShift(broadcastShift === s ? "" : s)} disabled={broadcastSending}
                                className="px-3 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-all"
                                style={{ background: isActive ? "#0369a1" : "#e0f2fe", color: isActive ? "#fff" : "#0369a1", border: `1px solid ${isActive ? "#0369a1" : "#e0f2fe"}` }}>
                                {s}
                              </button>
                            );
                          })}
                        </div>

                    {/* Divider */}
                    <div className="border-t -mx-5 md:-mx-6 mb-4" style={{ borderColor: "#e9edef" }} />

                    {/* Search students */}
                    <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Add Specific Students</label>
                    <div className="relative mb-3">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                        <input
                          type="text"
                          placeholder={broadcastChannel === "email" ? "Search by name, email, or phone..." : "Search by name or phone..."}
                          value={broadcastSearch}
                          onChange={(e) => { setBroadcastSearch(e.target.value); setBroadcastVisibleCount(10); }}
                          onFocus={() => setBroadcastSearchFocused(true)}
                          onBlur={() => setTimeout(() => setBroadcastSearchFocused(false), 200)}
                          disabled={broadcastSending || broadcastLoadingRecipients}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13.5px] outline-none placeholder:text-[#8696a0]"
                          style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                        />
                        {broadcastSearch && (
                          <button onClick={() => { setBroadcastSearch(""); setBroadcastVisibleCount(10); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center border-none cursor-pointer" style={{ background: "#d1d5db", color: "#fff" }}>
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                      {/* Search dropdown */}
                      {broadcastSearchFocused && broadcastSearch.trim() && (() => {
                        const unselected = broadcastSearchResults.filter((r) => !broadcastSelected.has(r.id));
                        if (broadcastSearchLoading) return (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl shadow-lg px-4 py-4 flex justify-center" style={{ background: "#fff", border: "1px solid #e9edef" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="#e9edef" strokeWidth="3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="#008069" strokeWidth="3" strokeLinecap="round" /></svg>
                          </div>
                        );
                        return unselected.length > 0 ? (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl shadow-lg overflow-hidden" style={{ background: "#fff", border: "1px solid #e9edef", maxHeight: 200, overflowY: "auto" }}>
                            {unselected.map((r) => (
                              <button
                                key={r.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setBroadcastRecipients((prev) => prev.some((p) => p.id === r.id) ? prev : [...prev, r]);
                                  setBroadcastSelected((prev) => new Set([...prev, r.id]));
                                  setBroadcastSearchAdded((prev) => new Set([...prev, r.id]));
                                  setBroadcastSearch("");
                                }}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-left border-none cursor-pointer transition-colors hover:bg-[#f0f2f5]"
                                style={{ background: "transparent", borderBottom: "1px solid #f0f2f5" }}
                              >
                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold text-white" style={{ background: `hsl(${getHue(r.name)}, 45%, 55%)` }}>
                                  {getInitials(r.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[13px] font-medium block truncate" style={{ color: "#111b21" }}>{r.name}</span>
                                  <span className="text-[11px] block" style={{ color: "#667781" }}>{r.phone}{r.program !== "—" ? ` · ${r.program}` : ""}</span>
                                </div>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00a884" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl shadow-lg px-4 py-3 text-center" style={{ background: "#fff", border: "1px solid #e9edef" }}>
                            <span className="text-[13px]" style={{ color: "#8696a0" }}>No matching students found</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Search-added chips */}
                    {broadcastSearchAdded.size > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {broadcastRecipients
                          .filter((r) => broadcastSearchAdded.has(r.id))
                          .map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full text-[11.5px] font-medium"
                              style={{ background: "#008069", color: "#fff" }}
                            >
                              {r.name}
                              <button
                                type="button"
                                onClick={() => {
                                  setBroadcastSearchAdded((prev) => { const n = new Set(prev); n.delete(r.id); return n; });
                                  setBroadcastSelected((prev) => { const n = new Set(prev); n.delete(r.id); return n; });
                                  setBroadcastRecipients((prev) => prev.filter((p) => p.id !== r.id));
                                }}
                                disabled={broadcastSending}
                                aria-label={`Remove ${r.name}`}
                                className="w-4 h-4 rounded-full flex items-center justify-center border-none cursor-pointer"
                                style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
                              >
                                <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </button>
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Recipients */}
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11.5px] font-semibold uppercase tracking-wider block" style={{ color: "#54656f" }}>
                        Recipients <span className="normal-case font-normal" style={{ color: "#8696a0" }}>· <span style={{ color: "#008069", fontWeight: 600 }}>{broadcastSelected.size}</span> of {broadcastRecipients.length}</span>
                      </label>
                    </div>
                    {broadcastLoadingRecipients ? (
                      <div className="flex items-center justify-center py-6 rounded-xl" style={{ background: "#f0f2f5" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="#e9edef" strokeWidth="3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="#008069" strokeWidth="3" strokeLinecap="round" /></svg>
                      </div>
                    ) : broadcastRecipients.length === 0 ? (
                      <div className="flex items-center justify-center py-6 rounded-xl text-center" style={{ background: "#f0f2f5" }}>
                        <span className="text-[12.5px]" style={{ color: "#8696a0" }}>No recipients match these filters</span>
                      </div>
                    ) : (() => {
                      const q = broadcastSearch.toLowerCase().trim();
                      const filteredRecipients = q ? broadcastRecipients.filter((r) => r.name.toLowerCase().includes(q) || (r.phone || "").includes(q) || (r.email || "").toLowerCase().includes(q)) : broadcastRecipients;
                      const visibleRecipients = filteredRecipients.slice(0, broadcastVisibleCount);
                      const hasMore = filteredRecipients.length > broadcastVisibleCount;
                      return filteredRecipients.length === 0 ? (
                        <div className="flex items-center justify-center py-6 rounded-xl text-center" style={{ background: "#f0f2f5" }}>
                          <span className="text-[12.5px]" style={{ color: "#8696a0" }}>No students match &ldquo;{broadcastSearch}&rdquo;</span>
                        </div>
                      ) : (
                      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#e9edef" }}>
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr style={{ background: "#f0f2f5" }}>
                              <th className="px-3 py-2 text-left w-9">
                                <input
                                  type="checkbox"
                                  checked={filteredRecipients.length > 0 && filteredRecipients.every((r) => broadcastSelected.has(r.id))}
                                  onChange={() => {
                                    const allSelected = filteredRecipients.every((r) => broadcastSelected.has(r.id));
                                    setBroadcastSelected((prev) => {
                                      const next = new Set(prev);
                                      for (const r of filteredRecipients) {
                                        if (allSelected) next.delete(r.id);
                                        else next.add(r.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  disabled={broadcastSending}
                                  className="w-4 h-4 accent-[#008069] cursor-pointer"
                                />
                              </th>
                              <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "#8696a0" }}>Name</th>
                              <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "#8696a0" }}>Program</th>
                              <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "#8696a0" }}>{broadcastChannel === "email" ? "Email" : "Phone"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRecipients.map((r) => (
                              <tr key={r.id} className="border-t" style={{ borderColor: "#f0f2f5" }}>
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={broadcastSelected.has(r.id)}
                                    onChange={() => {
                                      setBroadcastSelected((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(r.id)) next.delete(r.id);
                                        else next.add(r.id);
                                        return next;
                                      });
                                    }}
                                    disabled={broadcastSending}
                                    className="w-4 h-4 accent-[#008069] cursor-pointer"
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium truncate max-w-[140px]" style={{ color: "#111b21" }}>{r.name}</td>
                                <td className="px-3 py-2 truncate max-w-[140px]" style={{ color: "#667781" }}>{r.program}</td>
                                <td className="px-3 py-2 font-mono text-[11.5px] truncate max-w-[160px]" style={{ color: "#667781" }}>{broadcastChannel === "email" ? (r.email || "—") : r.phone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {hasMore && (
                          <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: "#f0f2f5", background: "#f8f9fa" }}>
                            <span className="text-[11px]" style={{ color: "#8696a0" }}>
                              Showing {visibleRecipients.length} of {filteredRecipients.length}
                              {q && <> match{filteredRecipients.length !== 1 ? "es" : ""}</>}
                            </span>
                            <button
                              onClick={() => setBroadcastVisibleCount((c) => c + 10)}
                              disabled={broadcastSending}
                              className="px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer border-none transition-colors"
                              style={{ background: "#008069", color: "#fff" }}
                            >
                              Load 10 more
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })()}
                  </div>

                  {/* ─── RIGHT: Compose ─── */}
                  <div className="lg:w-[45%] lg:overflow-y-auto px-5 md:px-6 py-5">
                    <div className="mb-5">
                      <h4 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#111b21", letterSpacing: "0.06em" }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-[10px]" style={{ background: "#008069", color: "#fff" }}>2</span>
                        Message
                      </h4>
                      <p className="text-[11.5px] mt-1 ml-7" style={{ color: "#8696a0" }}>
                        {broadcastChannel === "email" ? "Compose subject and body" : broadcastChannel === "whatsapp" ? "Pick a template (required for cold students) or write freeform" : "Pick a template or write your SMS"}
                      </p>
                    </div>

                    {broadcastChannel === "email" ? (
                      <>
                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Campaign Name <span className="normal-case font-normal" style={{ color: "#8696a0" }}>(internal)</span></label>
                        <input
                          type="text"
                          value={broadcastCampaignName}
                          onChange={(e) => setBroadcastCampaignName(e.target.value)}
                          disabled={broadcastSending}
                          placeholder="e.g. Alumni newsletter — April 2026"
                          className="w-full rounded-xl px-4 py-2.5 text-[13.5px] outline-none placeholder:text-[#8696a0] mb-4"
                          style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                        />
                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Template</label>
                        <select
                          value={broadcastEmailTemplateId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setBroadcastEmailTemplateId(id);
                            if (!id) return;
                            const tpl = broadcastEmailTemplates.find((t) => t.id === id);
                            if (tpl) {
                              setBroadcastEmailSubject(tpl.subject || "");
                              setBroadcastEmailBody(plainTextToHtml(tpl.body || ""));
                            }
                          }}
                          disabled={broadcastSending}
                          className="w-full rounded-xl px-4 py-2.5 text-[13.5px] outline-none mb-4"
                          style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                        >
                          <option value="">— None (write manually) —</option>
                          {broadcastEmailTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>

                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Subject</label>
                        <input
                          type="text"
                          value={broadcastEmailSubject}
                          onChange={(e) => setBroadcastEmailSubject(e.target.value)}
                          disabled={broadcastSending}
                          placeholder="Email subject..."
                          className="w-full rounded-xl px-4 py-2.5 text-[13.5px] outline-none placeholder:text-[#8696a0] mb-4"
                          style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                        />
                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Body</label>
                        <div className="rounded-xl overflow-hidden mb-3" style={{ background: "#fff", border: "1px solid #e9edef" }}>
                          <RichTextEditor
                            value={broadcastEmailBody}
                            onChange={setBroadcastEmailBody}
                            placeholder="Write your broadcast email..."
                            minHeight={180}
                          />
                        </div>
                        <div className="px-3 py-2 rounded-lg text-[11px] flex items-start gap-2" style={{ background: "#e8f4fb", color: "#0170B9", border: "1px solid #bde0f0" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="mt-[1px] shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                          <span>Sent via SendGrid as a mass campaign. Unsubscribe link added automatically. Bounced and opted-out students are auto-excluded.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>Template</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <select
                            value={broadcastWaCategory}
                            onChange={(e) => setBroadcastWaCategory(e.target.value as "" | WhatsAppTemplateCategory)}
                            disabled={broadcastSending}
                            className="flex-1 min-w-[160px] rounded-xl px-4 py-2.5 text-[13.5px] outline-none"
                            style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                          >
                            <option value="">— None (write manually) —</option>
                            <option value="inquiry">Inquiry</option>
                            <option value="followup">Follow-up</option>
                          </select>
                          <select
                            value={broadcastWaLang}
                            onChange={(e) => setBroadcastWaLang(e.target.value as "auto" | WhatsAppTemplateLang)}
                            disabled={broadcastSending || !broadcastWaCategory}
                            className="w-[150px] rounded-xl px-4 py-2.5 text-[13.5px] outline-none"
                            style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21", opacity: broadcastWaCategory ? 1 : 0.5 }}
                          >
                            <option value="auto">Auto (per student)</option>
                            <option value="EN">English</option>
                            <option value="ES">Spanish</option>
                          </select>
                        </div>
                        {broadcastWaCategory && (
                          <div className="mb-4 px-3 py-2 rounded-lg text-[11px] leading-relaxed" style={{ background: "#e7fce3", color: "#008069", border: "1px solid #c4f0c5" }}>
                            <div className="font-semibold mb-1">
                              Preview {broadcastWaLang === "auto" ? "(first recipient)" : `(${broadcastWaLang})`}:
                            </div>
                            {(() => {
                              const firstRecipient = broadcastRecipients.filter((r) => broadcastSelected.has(r.id))[0];
                              const lang = broadcastWaLang === "auto"
                                ? pickTemplateLang(firstRecipient?.language)
                                : broadcastWaLang;
                              const tpl = getTemplate(broadcastWaCategory as WhatsAppTemplateCategory, lang);
                              const name = firstRecipient?.name?.split(" ")[0] || "{{name}}";
                              const program = firstRecipient?.program && firstRecipient.program !== "—"
                                ? firstRecipient.program.split(",")[0].trim()
                                : tpl.fallback?.program || "";
                              return tpl.render({ name, program });
                            })()}
                          </div>
                        )}

                        <label className="text-[11.5px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#54656f" }}>
                          {broadcastWaCategory ? "Message (ignored — using template)" : "Message"}
                        </label>
                        <div className="relative mb-3">
                          <textarea
                            value={broadcastMsg}
                            onChange={(e) => setBroadcastMsg(e.target.value)}
                            disabled={broadcastSending || !!broadcastWaCategory}
                            placeholder={broadcastWaCategory ? "Template will be used; this is ignored" : "Type your broadcast message here..."}
                            rows={6}
                            className="w-full rounded-xl px-4 py-3 text-[14px] outline-none resize-none placeholder:text-[#8696a0]"
                            style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21", opacity: broadcastWaCategory ? 0.5 : 1 }}
                          />
                          <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: broadcastMsg.length > 1000 ? "#e74c3c" : "#8696a0" }}>{broadcastMsg.length}/1000</span>
                        </div>
                      </>
                    )}

                    {/* Progress bar (during send) */}
                    {broadcastSending && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12.5px] font-medium" style={{ color: "#111b21" }}>Sending...</span>
                          <span className="text-[12.5px] font-semibold" style={{ color: "#008069" }}>{broadcastProgress.sent + broadcastProgress.failed}/{broadcastProgress.total}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f0f2f5" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${((broadcastProgress.sent + broadcastProgress.failed) / Math.max(broadcastProgress.total, 1)) * 100}%`, background: broadcastProgress.failed > 0 ? "linear-gradient(90deg, #00a884, #e74c3c)" : "#00a884" }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            {!broadcastDone && (
              <div className="px-6 py-4 flex flex-col gap-3" style={{ borderTop: "1px solid #f0f0f0" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <SchedulePicker
                    mode={broadcastScheduleMode}
                    onModeChange={setBroadcastScheduleMode}
                    value={broadcastScheduleValue}
                    onValueChange={setBroadcastScheduleValue}
                    compact
                    disabled={broadcastSending}
                  />
                  <span className="text-[11px]" style={{ color: "#8696a0" }}>
                    {broadcastScheduleMode === "later" ? "Queued for the time above" : "Sends immediately"}
                  </span>
                </div>
                <button
                  onClick={handleBroadcastSend}
                  disabled={!canSendBroadcast || (broadcastScheduleMode === "later" && !broadcastScheduleValue)}
                  className="w-full py-3 rounded-full text-[15px] font-semibold cursor-pointer border-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: canSendBroadcast ? "#00a884" : "#e0e0e0",
                    color: canSendBroadcast ? "#fff" : "#8696a0",
                    boxShadow: canSendBroadcast ? "0 2px 12px rgba(0,168,132,0.3)" : "none",
                  }}>
                  {broadcastSending && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {broadcastSending
                    ? (broadcastScheduleMode === "later" ? "Scheduling..." : `Sending... (${broadcastProgress.sent + broadcastProgress.failed}/${broadcastProgress.total})`)
                    : `${broadcastScheduleMode === "later" ? "Schedule" : "Send"} to ${broadcastSelected.size} recipient${broadcastSelected.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── NEW CHAT MODAL ─── */}
      {showNewChat && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/25 backdrop-blur-sm" onClick={() => { setShowNewChat(false); setStudentSearch(""); setStudentResults([]); setNewChatStatus(""); setNewChatStatusOpen(false); }} />
          <div className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[95vw] h-[600px] max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: "#fff" }}>
            <div className="px-5 py-4" style={{ background: "#008069" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[17px] font-semibold text-white">New Chat</h3>
                <button onClick={() => { setShowNewChat(false); setStudentSearch(""); setStudentResults([]); setNewChatStatus(""); setNewChatStatusOpen(false); }} className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="relative mb-2">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                <input type="text" placeholder="Search by name, phone, or email..." value={contactSearch} onChange={(e) => setStudentSearch(e.target.value)} autoFocus
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl text-[14px] outline-none placeholder:text-white/50 text-white" style={{ background: "rgba(255,255,255,0.15)", border: "none" }} />
              </div>
              <div className="relative">
                {(() => {
                  const activeMeta = newChatStatus ? PIPELINE_STATUSES.find((s) => s.value === newChatStatus) : null;
                  return (
                    <button
                      onClick={() => setNewChatStatusOpen((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-medium cursor-pointer border-none"
                      style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                        {activeMeta ? (
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activeMeta.color }} />
                            <span className="truncate">{activeMeta.label}</span>
                          </span>
                        ) : (
                          <span>All lead statuses</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {activeMeta && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setNewChatStatus(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setNewChatStatus(""); } }}
                            className="text-[11px] font-semibold cursor-pointer"
                            style={{ color: "rgba(255,255,255,0.85)" }}
                          >
                            Clear
                          </span>
                        )}
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ transform: newChatStatusOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><path d="M6 9l6 6 6-6" /></svg>
                      </span>
                    </button>
                  );
                })()}
                {newChatStatusOpen && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl shadow-lg p-2" style={{ background: "#fff", border: "1px solid #e9edef", maxHeight: 240, overflowY: "auto" }}>
                    <div className="flex items-center justify-between px-2 py-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8696a0" }}>Lead Status</span>
                      <span className="text-[10px]" style={{ color: "#8696a0" }}>Pick one</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PIPELINE_STATUSES.map((s) => {
                        const isActive = newChatStatus === s.value;
                        return (
                          <button
                            key={s.value}
                            onClick={() => {
                              setNewChatStatus(s.value);
                              setNewChatStatusOpen(false);
                            }}
                            className="px-2.5 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-all"
                            style={{
                              background: isActive ? s.color : s.bg,
                              color: isActive ? "#fff" : s.color,
                              border: `1px solid ${isActive ? s.color : s.bg}`,
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {contactSearching ? <div className="flex items-center justify-center py-10"><span className="text-[14px]" style={{ color: "#8696a0" }}>Searching...</span></div>
              : studentResults.length === 0 ? <div className="flex items-center justify-center py-10"><span className="text-[14px]" style={{ color: "#8696a0" }}>No students found</span></div>
              : studentResults.map((student) => {
                const hue = getHue(student.name);
                return (
                  <button key={student.id} onClick={() => handleStartChat(student)}
                    className="flex items-center gap-3 w-full px-5 py-3.5 text-left border-none cursor-pointer transition-all hover:bg-[#f5f6f6]"
                    style={{ background: "transparent", borderBottom: "1px solid #f0f2f5" }}>
                    <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold text-white"
                      style={{ background: `linear-gradient(135deg, hsl(${hue}, 50%, 55%), hsl(${hue}, 50%, 42%))` }}>{getInitials(student.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px]" style={{ color: "#111b21" }}>{student.name}</div>
                      <div className="text-[13px]" style={{ color: "#8696a0" }}>{student.email || "No email"}</div>
                    </div>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#25d366" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ─── RIGHT: Chat ─── */}
      <div className={`flex flex-col flex-1 min-w-0 ${!selectedStudentId ? "hidden md:flex" : "flex"}`}>
        {!selectedStudentId ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full" style={{ background: "#f0f2f5" }}>
            <div className="w-[120px] h-[120px] rounded-full flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, #d9fdd3, #c4f0c5)" }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="#00a884" opacity="0.3"/></svg>
            </div>
            <h2 className="text-[28px] font-light mb-2" style={{ color: "#41525d" }}>GMTTI WhatsApp</h2>
            <p className="text-[15px] mb-6" style={{ color: "#8696a0" }}>Send and receive messages with students</p>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px]" style={{ background: "#d9fdd3", color: "#008069" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              End-to-end encrypted
            </div>
          </div>
        ) : (
          <>
            {toast && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium shrink-0" style={{ background: "#d9fdd3", borderBottom: "1px solid #c4f0c5", color: toast.color }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                {toast.message}
                <button onClick={() => setToast(null)} className="ml-auto border-none cursor-pointer" style={{ background: "transparent", color: toast.color, opacity: 0.6 }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Chat header */}
            <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 shrink-0" style={{ background: "#f0f2f5", borderBottom: "1px solid #e9edef" }}>
              {/* Back button — mobile only */}
              <button
                onClick={() => setSelectedStudentId(null)}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer shrink-0"
                style={{ background: "transparent", color: "#8696a0" }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
                style={{ background: `hsl(${getHue(selectedStudent?.name || "")}, 45%, 55%)` }}>
                {getInitials(selectedStudent?.name || "?")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] truncate" style={{ color: "#111b21" }}>{selectedStudent?.name}</div>
                <div className="text-[11px]" style={{ color: "#8696a0" }}>{selectedStudent?.phone}{selectedStudent?.email ? ` · ${selectedStudent.email}` : ""}</div>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={() => setShowClassify(!showClassify)}
                    disabled={classifying}
                    className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer border-none"
                    style={{ background: "#00a884", color: "#fff", opacity: classifying ? 0.7 : 1, cursor: classifying ? "wait" : "pointer" }}
                  >
                    {classifying ? (
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                        <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>
                    )}
                    <span className="hidden sm:inline">{classifying ? "Classifying..." : "Classify"}</span>
                  </button>
                  {showClassify && !classifying && (
                    <>
                      <div className="fixed inset-0 z-[98]" onClick={() => setShowClassify(false)} />
                      <div className="absolute right-0 top-full mt-1 z-[99] w-52 rounded-lg shadow-xl py-1 overflow-hidden" style={{ background: "#fff", border: "1px solid #e9edef" }}>
                        {LEAD_CLASSIFICATIONS.map((cls) => (
                          <button key={cls.value} onClick={() => handleClassify(cls.value)} className="flex items-center gap-2 w-full px-3 py-2 text-left border-none cursor-pointer text-[12px] font-medium transition-all hover:bg-[#f5f6f6]" style={{ color: cls.color, background: "transparent" }}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cls.color }} />{cls.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setSendChannel(sendChannel === "whatsapp" ? "sms" : "whatsapp")}
                  className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer border-none transition-all"
                  style={{ background: sendChannel === "whatsapp" ? "#25d366" : "#8b5cf6", color: "#fff" }}
                  title={`Sending via ${sendChannel === "whatsapp" ? "WhatsApp" : "SMS"} — click to switch`}
                >
                  {sendChannel === "whatsapp" ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  ) : (
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                  )}
                  <span className="hidden sm:inline">{sendChannel === "whatsapp" ? "WhatsApp" : "SMS"}</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto px-3 md:px-[4%] py-2 md:py-3" style={{ background: "#efeae2" }}>
              {messagesLoading ? <div className="flex items-center justify-center h-full"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="#e9edef" strokeWidth="3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="#00a884" strokeWidth="3" strokeLinecap="round" /></svg></div>
              : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="px-4 py-2 rounded-lg text-[11px] shadow-sm text-center" style={{ background: "#fcf4cb", color: "#54656f" }}>Send a template or message to start the conversation.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-[2px] max-w-2xl mx-auto">
                  {hasOlderMsgs && (
                    <div className="flex justify-center py-2">
                      <button
                        onClick={() => selectedStudentId && loadMessages(selectedStudentId, true)}
                        disabled={loadingOlder}
                        className="px-4 py-1.5 rounded-full text-[11px] font-medium border-none cursor-pointer shadow-sm"
                        style={{ background: "#fcf4cb", color: "#54656f" }}
                      >
                        {loadingOlder ? "Loading..." : "Load older messages"}
                      </button>
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isOut = msg.direction === "outbound";
                    return (
                      <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[85%] md:max-w-[70%] rounded-lg px-2.5 py-[5px]" style={{ background: isOut ? "#d9fdd3" : "#fff", boxShadow: "0 1px 0.5px rgba(11,20,26,0.08)", marginTop: i > 0 && messages[i - 1].direction !== msg.direction ? 6 : 0 }}>
                          <p className="text-[13.5px] leading-[18px] whitespace-pre-wrap" style={{ color: "#111b21" }}>{msg.body}</p>
                          <div className="flex items-center gap-1 mt-[1px] justify-end">
                            <span className="text-[10px]" style={{ color: "#667781" }}>{formatTime(msg.created_at)}</span>
                            {isOut && (() => {
                              const s = msg.status as string;
                              const isPending = msg.id.startsWith("temp-") || s === "queued" || s === "accepted" || s === "sending";
                              if (isPending) {
                                return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-label="Pending"><circle cx="12" cy="12" r="10" stroke="#8696a0" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="#8696a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
                              }
                              if (msg.status === "failed" || msg.status === "undelivered") {
                                return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-label={msg.status === "failed" ? "Failed" : "Undelivered"}><circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" fill="#fff"/><path d="M12 7v6" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="16.5" r="0.9" fill="#ef4444"/></svg>;
                              }
                              if (msg.status === "sent") {
                                return <svg width="12" height="10" viewBox="0 0 16 11" fill="none" aria-label="Sent"><path d="M3 6l3 3L14 2" stroke="#8696a0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
                              }
                              const color = msg.status === "read" ? "#53bdeb" : "#8696a0";
                              return <svg width="15" height="10" viewBox="0 0 16 11" fill="none" aria-label={msg.status === "read" ? "Read" : "Delivered"}><path d="M1 6l3 3L12 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 6l3 3L15 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            {showTemplatePicker ? (
              <div className="shrink-0 px-3 md:px-4 py-2.5" style={{ background: "#f0f2f5", borderTop: "1px solid #e9edef" }}>
                <div className="max-w-2xl mx-auto flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[11.5px] leading-snug" style={{ color: "#6b4f00" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span>
                      {whatsappWindowOpen
                        ? "Sending an approved template. Switch back to free chat anytime."
                        : "24-hour window closed. Send an approved template to start the conversation."}
                    </span>
                    {whatsappWindowOpen && (
                      <button
                        onClick={() => setUseTemplateMode(false)}
                        className="ml-auto px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer border-none shrink-0"
                        style={{ background: "#fff", color: "#00a884", border: "1px solid #00a884" }}
                        title="Back to free chat"
                      >
                        ← Back to chat
                      </button>
                    )}
                  </div>

                  {/* Template + language pickers */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value as WhatsAppTemplateCategory)}
                      className="px-3 py-1.5 rounded-full text-[11.5px] font-bold cursor-pointer outline-none"
                      style={{ background: "#fff", border: "1px solid #d1d7db", color: "#111b21" }}
                    >
                      <option value="inquiry">Inquiry</option>
                      <option value="followup">Follow-up</option>
                    </select>
                    <div className="flex items-center p-[3px] rounded-full shrink-0" style={{ background: "#fff", border: "1px solid #d1d7db" }}>
                      {(["EN", "ES"] as WhatsAppTemplateLang[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setTemplateLang(lang)}
                          className="px-3 py-1 rounded-full text-[11.5px] font-bold cursor-pointer border-none transition-all"
                          style={{
                            background: templateLang === lang ? "#00a884" : "transparent",
                            color: templateLang === lang ? "#fff" : "#54656f",
                          }}
                        >
                          {lang === "EN" ? "English" : "Español"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[12px] leading-snug whitespace-pre-wrap break-words" style={{ background: "#fff", border: "1px solid #e9edef", color: "#54656f" }}>
                      {templatePreview}
                    </div>
                    <button
                      onClick={handleSendTemplate}
                      disabled={sendingTemplate || (chatScheduleMode === "later" && !chatScheduleValue)}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed self-start"
                      style={{ background: "#00a884", color: "#fff" }}
                      title={`${chatScheduleMode === "later" ? "Schedule" : "Send"} ${getTemplate(templateCategory, templateLang).label}`}
                    >
                      {sendingTemplate ? (
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                          <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" fill="white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                      )}
                      {sendingTemplate ? (chatScheduleMode === "later" ? "Scheduling..." : "Sending...") : (chatScheduleMode === "later" ? "Schedule" : "Send")}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <SchedulePicker
                      mode={chatScheduleMode}
                      onModeChange={setChatScheduleMode}
                      value={chatScheduleValue}
                      onValueChange={setChatScheduleValue}
                      compact
                      disabled={sendingTemplate}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="shrink-0 px-2 md:px-3 py-1.5 flex flex-col gap-1" style={{ background: "#f0f2f5" }}>
                <div className="flex items-end gap-1.5 md:gap-2 max-w-2xl mx-auto w-full">
                  {sendChannel === "whatsapp" && (
                    <button
                      onClick={() => setUseTemplateMode(true)}
                      title="Send an approved template instead"
                      className="shrink-0 w-[36px] h-[36px] rounded-full flex items-center justify-center cursor-pointer border-none transition-colors hover:bg-[#e9edef]"
                      style={{ background: "transparent", color: "#54656f" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <line x1="8" y1="9" x2="16" y2="9" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="12" y2="17" />
                      </svg>
                    </button>
                  )}
                  <textarea ref={inputRef} value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={chatScheduleMode === "later" ? "Type the message to schedule..." : "Type a message"} rows={1}
                    className="flex-1 resize-none rounded-[18px] px-4 py-2 text-[13px] outline-none placeholder:text-[#8696a0]"
                    style={{ background: "#fff", border: "none", color: "#111b21", maxHeight: 100 }}
                    onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }} />
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || (chatScheduleMode === "later" && !chatScheduleValue)}
                    title={chatScheduleMode === "later" ? "Schedule" : "Send"}
                    className="shrink-0 w-[36px] h-[36px] rounded-full flex items-center justify-center cursor-pointer border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: messageInput.trim() ? "#00a884" : "#d9dbde" }}>
                    {chatScheduleMode === "later" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    ) : (
                      <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                    )}
                  </button>
                </div>
                <div className="max-w-2xl mx-auto w-full flex justify-end">
                  <SchedulePicker
                    mode={chatScheduleMode}
                    onModeChange={setChatScheduleMode}
                    value={chatScheduleValue}
                    onValueChange={setChatScheduleValue}
                    compact
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── SCHEDULED MESSAGE EDIT MODAL ─── */}
      {scheduledEditId && (() => {
        const editing = scheduledItems.find((x) => x.id === scheduledEditId);
        if (!editing) return null;
        return (
          <>
            <div className="fixed inset-0 z-[220] bg-black/30 backdrop-blur-sm" onClick={() => !scheduledSaving && setScheduledEditId(null)} />
            <div className="fixed z-[221] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[95vw] max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: "#fff" }}>
              <div className="px-5 py-3" style={{ background: "#008069", color: "#fff" }}>
                <h3 className="text-[16px] font-semibold">Edit scheduled {editing.channel}</h3>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3 overflow-auto">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#8696a0" }}>When (Miami EST)</label>
                  <input
                    type="datetime-local"
                    value={scheduledEditAt}
                    onChange={(e) => setScheduledEditAt(e.target.value)}
                    step={60}
                    className="w-full px-3 py-2 rounded text-[13px] outline-none"
                    style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                  />
                </div>
                {editing.channel === "email" && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#8696a0" }}>Subject</label>
                    <input
                      type="text"
                      value={scheduledEditSubject}
                      onChange={(e) => setScheduledEditSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded text-[13px] outline-none"
                      style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21" }}
                    />
                  </div>
                )}
                {editing.channel !== "whatsapp" && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#8696a0" }}>Message</label>
                    <textarea
                      value={scheduledEditBody}
                      onChange={(e) => setScheduledEditBody(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded text-[13px] outline-none resize-y"
                      style={{ background: "#f0f2f5", border: "1px solid #e9edef", color: "#111b21", fontFamily: "inherit" }}
                    />
                  </div>
                )}
                {editing.channel === "whatsapp" && (
                  <div className="text-[12px] p-3 rounded" style={{ background: "#fff8e1", color: "#7a5a00", border: "1px solid #ffe0a6" }}>
                    WhatsApp template body is pre-approved and cannot be edited. You can only reschedule the time or cancel and re-create.
                  </div>
                )}
              </div>
              <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: "1px solid #f0f2f5" }}>
                <button
                  onClick={() => setScheduledEditId(null)}
                  disabled={scheduledSaving}
                  className="px-4 py-1.5 rounded text-[13px] font-semibold cursor-pointer border"
                  style={{ background: "#fff", color: "#54656f", borderColor: "#d1d7db" }}
                >
                  Close
                </button>
                <button
                  onClick={saveScheduledEdit}
                  disabled={scheduledSaving || !scheduledEditAt}
                  className="px-4 py-1.5 rounded text-[13px] font-semibold cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "#008069" }}
                >
                  {scheduledSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ─── SCHEDULED CANCEL CONFIRM MODAL ─── */}
      {scheduledCancelId && (
        <>
          <div className="fixed inset-0 z-[220] bg-black/30 backdrop-blur-sm" onClick={() => !scheduledSaving && setScheduledCancelId(null)} />
          <div className="fixed z-[221] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] max-w-[95vw] rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#fff" }}>
            <div className="px-5 py-4">
              <h3 className="text-[16px] font-semibold mb-1" style={{ color: "#111b21" }}>Cancel scheduled message?</h3>
              <p className="text-[13px]" style={{ color: "#667781" }}>
                This message will not be sent. This cannot be undone.
              </p>
            </div>
            <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: "1px solid #f0f2f5" }}>
              <button
                onClick={() => setScheduledCancelId(null)}
                disabled={scheduledSaving}
                className="px-4 py-1.5 rounded text-[13px] font-semibold cursor-pointer border"
                style={{ background: "#fff", color: "#54656f", borderColor: "#d1d7db" }}
              >
                Keep it
              </button>
              <button
                onClick={confirmScheduledCancel}
                disabled={scheduledSaving}
                className="px-4 py-1.5 rounded text-[13px] font-semibold cursor-pointer border-none text-white disabled:opacity-50"
                style={{ background: "#dc2626" }}
              >
                {scheduledSaving ? "Cancelling..." : "Cancel message"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
