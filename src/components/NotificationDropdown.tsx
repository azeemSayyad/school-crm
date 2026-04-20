"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Avatar } from "./ui";
import { Icons } from "./Icons";

interface Notification {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  message: string;
  lead_name: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { color: string; bg: string; icon: string }> = {
  new_lead:     { color: "#6366f1", bg: "#eef2ff", icon: "●" },
  stage_change: { color: "#3b82f6", bg: "#eff6ff", icon: "◉" },
  appointment:  { color: "#059669", bg: "#ecfdf5", icon: "◆" },
  no_show:      { color: "#ef4444", bg: "#fef2f2", icon: "◇" },
  enrollment:   { color: "#16a34a", bg: "#f0fdf4", icon: "✦" },
  broadcast:    { color: "#f59e0b", bg: "#fffbeb", icon: "◎" },
  new_email:    { color: "#0170B9", bg: "#e8f4fb", icon: "✉" },
  system:       { color: "#9ca3af", bg: "#f2f3f7", icon: "⚙" },
  appointment_assigned: { color: "#8b5cf6", bg: "#f5f3ff", icon: "📋" },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationDropdown({
  onUnreadCountChange,
  userId,
}: {
  onUnreadCountChange: (count: number) => void;
  userId?: number | null;
}) {
  const PAGE = 20;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onUnreadRef = useRef(onUnreadCountChange);
  onUnreadRef.current = onUnreadCountChange;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Sync unread count to parent whenever notifications change
  useEffect(() => {
    onUnreadRef.current(unreadCount);
  }, [unreadCount]);

  // Initial fetch
  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }

    const load = async () => {
      let query = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, PAGE - 1);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { data } = await query;
      if (data) {
        setNotifications(data);
        setHasMore(data.length === PAGE);
      }
      setLoading(false);
    };

    load();
  }, [userId]);

  // Supabase Realtime — listen for new notifications
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Only add if it's for this user or global
          if (userId && newNotif.user_id !== null && newNotif.user_id !== userId) return;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoadingMore(true);

    const offset = notifications.length;
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data } = await query;
    if (data) {
      setNotifications((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE);
    }
    setLoadingMore(false);
  }, [notifications.length, userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAsRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    if (isSupabaseConfigured()) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (isSupabaseConfigured()) {
      await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unreadCount > 0) markAllAsRead();
        }}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border-none cursor-pointer transition-all"
        style={{
          background: open ? "rgba(255,255,255,0.2)" : "transparent",
          color: "rgba(255,255,255,0.8)",
        }}
      >
        {Icons.bell}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="fixed right-3 left-3 sm:left-auto sm:right-4 sm:w-[380px] top-[68px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-[100] animate-[fadeUp_0.15s_ease]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[var(--c-text)]">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-[var(--c-accent)] text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11.5px] font-semibold text-[var(--c-accent)] bg-transparent border-none cursor-pointer hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-[var(--c-text-muted)] text-xs">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-[var(--c-bg-subtle)] flex items-center justify-center mb-2 text-[var(--c-text-muted)]">
                  {Icons.bell}
                </div>
                <div className="text-[12.5px] font-semibold text-[var(--c-text)] mb-0.5">No notifications</div>
                <div className="text-[11.5px] text-[var(--c-text-muted)]">Activity will appear here</div>
              </div>
            ) : (
              <>
                {notifications.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.system;
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-2.5 px-4 py-3 border-b border-[var(--c-border-light)] cursor-pointer transition-colors hover:bg-[var(--c-bg-subtle)]"
                      onClick={() => !n.is_read && markAsRead(n.id)}
                      style={{ background: n.is_read ? "transparent" : meta.bg + "40" }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                        style={{ background: meta.color + "15", color: meta.color }}
                      >
                        {n.lead_name ? <Avatar name={n.lead_name} size={32} /> : meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="text-[12.5px] font-semibold text-[var(--c-text)] leading-tight">
                            {n.title}
                            {!n.is_read && (
                              <span className="inline-block w-[5px] h-[5px] rounded-full ml-1 align-middle" style={{ background: meta.color }} />
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--c-text-muted)] shrink-0 mt-0.5">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-[var(--c-text-secondary)] leading-[1.35] mt-0.5 line-clamp-2">
                          {n.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full py-2.5 text-[12px] font-semibold text-[var(--c-accent)] bg-transparent border-none cursor-pointer hover:bg-[var(--c-bg-subtle)] transition-colors"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
