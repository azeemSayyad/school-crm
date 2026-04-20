"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PIPELINE_STATUSES, DATA_SOURCES } from "@/lib/crm-types";

/* ─── Types ─── */
interface MetricCard { label: string; value: number; sub?: string }
interface SourceBreakdown { source: string; count: number }
interface RecentLead { id: string; name: string; phone: string; data_source: string; created_at: string; campaign_name: string | null; pipeline_status: string }
interface ActivityEntry { id: string; contact_name: string; channel: string; message_type: string; notes: string; date: string }
interface WeekData { label: string; count: number }

/* ─── Brand Colors ─── */
const BRAND = {
  bg: "#F7F8FA",
  card: "#FFFFFF",
  cardBorder: "rgba(0, 151, 167, 0.10)",
  cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  cardHoverBorder: "rgba(0,151,167,0.25)",
  cardHoverShadow: "0 4px 12px rgba(0,151,167,0.08)",
  teal: "#0097A7",
  tealDark: "#00796B",
  blue: "#0A84FF",
  amber: "#E68A00",
  green: "#1B9E3E",
  red: "#E5383B",
  purple: "#7B2CBF",
  textPrimary: "#111827",
  textSecondary: "#5F6B7A",
  textTertiary: "#9CA3AF",
  barBg: "#F0F1F3",
  divider: "#F0F1F3",
};

/* ─── Helpers ─── */
const getInitials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Source labels and colors are derived from the canonical DATA_SOURCES
// constant in crm-types so the dashboard pills always match the students
// page. "Manual" is the dashboard's preferred display label for
// crm_native — overridden here.
const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  DATA_SOURCES.map((s) => [s.value, s.value === "crm_native" ? "Manual" : s.label])
);
const SOURCE_COLORS: Record<string, string> = Object.fromEntries(
  DATA_SOURCES.map((s) => [s.value, s.color])
);

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  google_ads: { label: "Google Ads", color: BRAND.blue },
  meta_ads: { label: "Meta", color: "#1877f2" },
  whatsapp: { label: "WhatsApp", color: "#25d366" },
  sms: { label: "SMS", color: BRAND.purple },
  phone: { label: "Phone", color: BRAND.amber },
  email: { label: "Email", color: BRAND.teal },
  in_person: { label: "In Person", color: BRAND.green },
  other: { label: "Other", color: "#6b7280" },
};

const PIPELINE_BAR_COLORS: Record<string, string> = {
  New: "#0170B9",
  "Attempted to student": "#3b82f6",
  Appointment: "#8b5cf6",
  Hot: "#ef4444",
  Warm: "#f97316",
  Cold: "#64748b",
  "Bad timing": "#eab308",
  "In pipeline": "#6366f1",
  Enrolled: "#10b981",
  Inservice: "#14b8a6",
  "Too far to attend": "#9ca3af",
  "No legal status": "#f59e0b",
  "Opted out": "#78716c",
  Dead: "#374151",
};

/* ─── Count-Up Hook ─── */
function useCountUp(end: number, duration = 600) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (end === 0) { setValue(0); return; }
    const start = ref.current;
    const startTime = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + (end - start) * eased);
      setValue(current);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        ref.current = end;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);

  return value;
}

/* ─── Animated Number Component ─── */
function AnimatedNumber({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{display}</>;
}

/* ─── Smooth SVG Path Helper (Catmull-Rom → Cubic Bezier) ─── */
function smoothPath(points: [number, number][], tension = 0.4): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;

  let d = `M${points[0][0]},${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension / 3;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }

  return d;
}

/* ─── Card Wrapper ─── */
function Card({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      className={`rounded-[14px] ${className}`}
      style={{
        background: BRAND.card,
        border: `1px solid rgba(0,0,0,0.06)`,
        boxShadow: BRAND.cardShadow,
      }}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[16px] font-semibold mb-5" style={{ color: BRAND.textPrimary }}>{children}</h3>;
}

/* ─── Main Dashboard ─── */
export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<{ status: string; count: number }[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [recentLeadsTotal, setRecentLeadsTotal] = useState(0);
  const [recentLeadsPage, setRecentLeadsPage] = useState(1);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [callStats, setCallStats] = useState({ total: 0, answered: 0 });
  const [barsVisible, setBarsVisible] = useState(false);
  const [activityOpen, setActivityOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const LEADS_PER_PAGE = 20;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setBarsVisible(false);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Helper: count with filters (no row limit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countWhere = async (filters?: (q: any) => any) => {
      let q = supabase.from("students").select("id", { count: "exact", head: true });
      if (filters) q = filters(q);
      const { count } = await q;
      return count || 0;
    };

    // All metric counts in parallel
    const [total, todayCount, weekCount, monthCount, enrolledCount] = await Promise.all([
      countWhere(),
      countWhere((q) => q.gte("created_at", todayStart)),
      countWhere((q) => q.gte("created_at", weekStart)),
      countWhere((q) => q.gte("created_at", monthStart)),
      countWhere((q) => q.in("pipeline_status", ["Enrolled", "Inservice"])),
    ]);

    setMetrics([
      { label: "Leads Today", value: todayCount },
      { label: "This Week", value: weekCount },
      { label: "This Month", value: monthCount },
      { label: "Total Leads", value: total },
      { label: "Enrolled", value: enrolledCount, sub: total > 0 ? `${((enrolledCount / total) * 100).toFixed(1)}% conversion` : "0% conversion" },
    ]);

    // Source counts in parallel
    const SOURCE_KEYS = ["google_ads", "meta_ads", "crm_native", "hubspot_import"];
    const srcCounts = await Promise.all(
      SOURCE_KEYS.map(async (src) => ({
        source: src,
        count: await countWhere((q) => q.eq("data_source", src)),
      }))
    );
    setSourceBreakdown(srcCounts.sort((a, b) => b.count - a.count));

    // Pipeline funnel counts in parallel
    const pipeCounts = await Promise.all(
      PIPELINE_STATUSES.map(async (ps) => ({
        status: ps.value,
        count: await countWhere((q) => q.eq("pipeline_status", ps.value)),
      }))
    );
    setPipelineCounts(pipeCounts);

    // Weekly trend counts in parallel
    const weeks: WeekData[] = [];
    const weekPromises: Promise<{ label: string; count: number }>[] = [];
    for (let i = 3; i >= 0; i--) {
      const ws = new Date(now); ws.setDate(ws.getDate() - (i * 7 + ws.getDay()));
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      const label = ws.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weekPromises.push(
        countWhere((q) => q.gte("created_at", ws.toISOString()).lt("created_at", we.toISOString()))
          .then((count) => ({ label, count }))
      );
    }
    const weekResults = await Promise.all(weekPromises);
    setWeekData(weekResults);

    // Calls
    const { data: calls } = await supabase.from("activity_log").select("outcome").eq("channel", "phone");
    if (calls) setCallStats({ total: calls.length, answered: calls.filter((c) => c.outcome === "answered").length });

    // Recent leads
    const rlFrom = (recentLeadsPage - 1) * LEADS_PER_PAGE;
    const { data: recent, count: rlCount } = await supabase.from("students").select("id, name, phone, data_source, created_at, campaign_name, pipeline_status", { count: "exact" }).order("created_at", { ascending: false }).range(rlFrom, rlFrom + LEADS_PER_PAGE - 1);
    setRecentLeads((recent as RecentLead[]) || []);
    setRecentLeadsTotal(rlCount || 0);

    // Activity feed
    const { data: actRaw } = await supabase.from("activity_log").select("id, student_id, channel, message_type, notes, date").order("date", { ascending: false }).limit(12);
    if (actRaw && actRaw.length > 0) {
      const cids = [...new Set(actRaw.map((a) => a.student_id))];
      const { data: actStudents } = await supabase.from("students").select("id, name").in("id", cids);
      const nameMap = new Map((actStudents || []).map((c: { id: string; name: string }) => [c.id, c.name]));
      setActivities(actRaw.map((a) => ({ id: a.id, contact_name: nameMap.get(a.student_id) || "Unknown", channel: a.channel, message_type: a.message_type || "", notes: a.notes || "", date: a.date })));
    }


    setLoading(false);
    // Trigger bar animations after paint
    requestAnimationFrame(() => setBarsVisible(true));
  }, []);

  useEffect(() => { if (isSupabaseConfigured()) loadDashboard(); }, [loadDashboard]);

  // Reload recent leads on page change
  const reloadRecentLeads = useCallback(async () => {
    const rlFrom = (recentLeadsPage - 1) * LEADS_PER_PAGE;
    const { data: recent, count: rlCount } = await supabase.from("students").select("id, name, phone, data_source, created_at, campaign_name, pipeline_status", { count: "exact" }).order("created_at", { ascending: false }).range(rlFrom, rlFrom + LEADS_PER_PAGE - 1);
    setRecentLeads((recent as RecentLead[]) || []);
    setRecentLeadsTotal(rlCount || 0);
  }, [recentLeadsPage]);

  useEffect(() => { if (!loading && isSupabaseConfigured()) reloadRecentLeads(); }, [recentLeadsPage, reloadRecentLeads]);

  /* ─── Loading State ─── */
  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]" style={{ background: BRAND.bg }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="animate-spin">
        <circle cx="12" cy="12" r="10" stroke={BRAND.divider} strokeWidth="3" />
        <path d="M12 2a10 10 0 019.75 7.75" stroke={BRAND.teal} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );

  /* ─── Computed Values ─── */
  const maxSource = Math.max(...sourceBreakdown.map((s) => s.count), 1);
  const totalPipeline = pipelineCounts.reduce((a, b) => a + b.count, 0) || 1;
  const maxPipeline = Math.max(...pipelineCounts.map((p) => p.count), 1);
  const maxWeek = Math.max(...weekData.map((w) => w.count), 1);
  const answerRate = callStats.total > 0 ? ((callStats.answered / callStats.total) * 100).toFixed(0) : "0";

  /* ─── Chart Points ─── */
  const chartW = 400;
  const chartH = 180;
  const chartPadX = 50;
  const chartPadTop = 20;
  const chartPadBot = 40;
  const chartPoints: [number, number][] = weekData.map((w, i) => [
    chartPadX + i * ((chartW - chartPadX * 2) / Math.max(weekData.length - 1, 1)),
    chartPadTop + (chartH - chartPadTop - chartPadBot) * (1 - w.count / maxWeek),
  ]);
  const linePath = smoothPath(chartPoints, 0.4);
  const areaPath = chartPoints.length >= 2
    ? `${linePath} L${chartPoints[chartPoints.length - 1][0]},${chartH - chartPadBot} L${chartPoints[0][0]},${chartH - chartPadBot} Z`
    : "";

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: BRAND.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div className={`flex flex-col lg:grid h-full ${activityOpen ? "lg:grid-cols-[1fr_280px]" : "lg:grid-cols-[1fr_40px]"}`} style={{ transition: "grid-template-columns 0.3s ease" }}>
      {/* ─── Main Content ─── */}
      <div className="overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">

        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: BRAND.textPrimary }}>Dashboard</h1>
            <p className="text-[13px] mt-0.5" style={{ color: BRAND.textSecondary }}>Lead performance and pipeline overview</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={loadDashboard}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer border-none"
            style={{ background: BRAND.teal, color: "#fff", boxShadow: "0 2px 10px rgba(0,151,167,0.25)" }}
          >
            Refresh
          </motion.button>
        </motion.div>

        {/* ─── Top Stats Row ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-6">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.05 }}
              className="rounded-[14px] p-6 cursor-default group"
              style={{
                background: BRAND.card,
                border: `1px solid rgba(0,0,0,0.06)`,
                boxShadow: BRAND.cardShadow,
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = BRAND.cardHoverBorder;
                e.currentTarget.style.boxShadow = BRAND.cardHoverShadow;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
                e.currentTarget.style.boxShadow = BRAND.cardShadow;
              }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2" style={{ color: BRAND.textTertiary }}>{m.label}</div>
              <div className="text-[40px] font-bold tracking-tight leading-none" style={{ color: BRAND.textPrimary }}>
                <AnimatedNumber value={m.value} />
              </div>
              {m.sub && <div className="text-[12px] mt-2" style={{ color: BRAND.textTertiary }}>{m.sub}</div>}
            </motion.div>
          ))}
        </div>

        {/* ─── Lead Status Funnel ─── */}
        <Card className="p-6 mb-6" delay={0.1}>
          <SectionTitle>Lead Status Funnel</SectionTitle>
          <div className="flex flex-col gap-3">
            {pipelineCounts.map((p) => {
              const barColor = PIPELINE_BAR_COLORS[p.status] || BRAND.teal;
              const pct = totalPipeline > 0 ? Math.round((p.count / totalPipeline) * 100) : 0;
              return (
                <div key={p.status} className="flex items-center gap-4">
                  <span className="text-[13px] w-[160px] text-right shrink-0 font-medium" style={{ color: BRAND.textSecondary }}>{p.status}</span>
                  <div className="flex-1 h-8 rounded-lg overflow-hidden" style={{ background: BRAND.barBg }}>
                    <div
                      className="h-full rounded-lg flex items-center pl-3"
                      style={{
                        background: barColor,
                        width: barsVisible ? `${Math.max((p.count / maxPipeline) * 100, p.count > 0 ? 8 : 0)}%` : "0%",
                        transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      {p.count > 0 && <span className="text-[12px] font-semibold text-white">{p.count}</span>}
                    </div>
                  </div>
                  <span className="text-[13px] w-10 text-right" style={{ color: BRAND.textTertiary }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ─── 2-col: Leads by Source + Call Tracking ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Leads by Source */}
          <Card className="p-6" delay={0.15}>
            <SectionTitle>Leads by Source</SectionTitle>
            <div className="flex flex-col gap-3">
              {sourceBreakdown.map((s) => {
                const barColor = SOURCE_COLORS[s.source] || "#6b7280";
                return (
                  <div key={s.source} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-[110px] shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: barColor }} />
                      <span className="text-[13px] font-medium truncate" style={{ color: BRAND.textSecondary }}>{SOURCE_LABELS[s.source] || s.source}</span>
                    </div>
                    <div className="flex-1 h-8 rounded-lg overflow-hidden" style={{ background: BRAND.barBg }}>
                      <div
                        className="h-full rounded-lg"
                        style={{
                          background: barColor,
                          width: barsVisible && s.count > 0 ? `${(s.count / maxSource) * 100}%` : "0%",
                          transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                    <span className="text-[14px] font-semibold w-8 text-right shrink-0" style={{ color: s.count > 0 ? BRAND.textPrimary : BRAND.textTertiary }}>{s.count}</span>
                  </div>
                );
              })}
              {sourceBreakdown.length === 0 && <span className="text-[13px]" style={{ color: BRAND.textTertiary }}>No data yet</span>}
            </div>
          </Card>

          {/* Call Tracking */}
          <Card className="p-6" delay={0.2}>
            <SectionTitle>Call Tracking</SectionTitle>
            <div className="flex gap-8">
              <div>
                <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: BRAND.textTertiary }}>Total</div>
                <div className="text-[28px] font-bold" style={{ color: BRAND.textPrimary }}><AnimatedNumber value={callStats.total} /></div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: BRAND.textTertiary }}>Answered</div>
                <div className="text-[28px] font-bold" style={{ color: BRAND.green }}><AnimatedNumber value={callStats.answered} /></div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: BRAND.textTertiary }}>Rate</div>
                <div className="text-[28px] font-bold" style={{ color: BRAND.amber }}>{answerRate}%</div>
              </div>
            </div>
          </Card>
        </div>

        {/* ─── Weekly Trend ─── */}
        <Card className="p-6 mb-6" delay={0.25}>
          <SectionTitle>Leads per Week</SectionTitle>
          <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" className="block">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0,151,167,0.10)" />
                <stop offset="100%" stopColor="rgba(0,151,167,0)" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => {
              const y = chartPadTop + i * ((chartH - chartPadTop - chartPadBot) / 3);
              return <line key={i} x1={chartPadX} y1={y} x2={chartW - chartPadX} y2={y} stroke={BRAND.divider} strokeWidth="1" />;
            })}
            {chartPoints.length >= 2 && <path d={areaPath} fill="url(#areaGrad)" />}
            {chartPoints.length >= 2 && (
              <path d={linePath} fill="none" stroke={BRAND.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {chartPoints.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill={BRAND.card} stroke={BRAND.teal} strokeWidth="2" />
                <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fill={BRAND.textPrimary} fontWeight="600" fontFamily="'Inter', sans-serif">{weekData[i].count}</text>
                <text x={x} y={chartH - 12} textAnchor="middle" fontSize="11" fill={BRAND.textTertiary} fontFamily="'Inter', sans-serif">{weekData[i].label}</text>
              </g>
            ))}
          </svg>
        </Card>

        {/* ─── Recent Leads ─── */}
        <Card className="p-6" delay={0.35}>
          <SectionTitle>Recent Leads</SectionTitle>
          <div className="flex flex-col">
            {recentLeads.map((lead, i) => {
              const ps = PIPELINE_STATUSES.find((p) => p.value === (lead.pipeline_status || "New"));
              const srcColor = SOURCE_COLORS[lead.data_source] || "#6b7280";
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 py-4 px-2"
                  style={{ borderBottom: i < recentLeads.length - 1 ? `1px solid ${BRAND.divider}` : "none" }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
                    style={{ background: "rgba(0,151,167,0.10)", color: BRAND.teal }}
                  >
                    {getInitials(lead.name)}
                  </div>
                  {/* Name + Phone */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate" style={{ color: BRAND.textPrimary }}>{lead.name}</div>
                    <div className="text-[13px]" style={{ color: BRAND.textSecondary }}>{lead.phone}</div>
                  </div>
                  {/* Pipeline badge */}
                  {ps && (
                    <span
                      className="text-[11px] font-semibold px-3 py-1 rounded-full shrink-0"
                      style={{ background: `${PIPELINE_BAR_COLORS[ps.value] || BRAND.teal}15`, color: PIPELINE_BAR_COLORS[ps.value] || BRAND.teal }}
                    >
                      {ps.label}
                    </span>
                  )}
                  {/* Source badge */}
                  <span
                    className="text-[11px] font-semibold px-3 py-1 rounded-full shrink-0"
                    style={{ background: `${srcColor}18`, color: srcColor }}
                  >
                    {SOURCE_LABELS[lead.data_source] || lead.data_source}
                  </span>
                  {/* Date */}
                  <span className="text-[12px] shrink-0" style={{ color: BRAND.textTertiary }}>
                    {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
            {recentLeads.length === 0 && <span className="text-[13px]" style={{ color: BRAND.textTertiary }}>No leads yet</span>}
          </div>
          {recentLeadsTotal > LEADS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${BRAND.divider}` }}>
              <button
                onClick={() => setRecentLeadsPage((p) => Math.max(1, p - 1))}
                disabled={recentLeadsPage === 1}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
                style={{ background: BRAND.barBg, color: BRAND.textSecondary }}
              >
                Previous
              </button>
              <span className="text-[12px]" style={{ color: BRAND.textTertiary }}>
                Page {recentLeadsPage} of {Math.ceil(recentLeadsTotal / LEADS_PER_PAGE)}
              </span>
              <button
                onClick={() => setRecentLeadsPage((p) => p + 1)}
                disabled={recentLeadsPage >= Math.ceil(recentLeadsTotal / LEADS_PER_PAGE)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
                style={{ background: BRAND.barBg, color: BRAND.textSecondary }}
              >
                Next
              </button>
            </div>
          )}
        </Card>

      </div>
      </div>

      {/* ─── Right Sidebar: Activity Feed (collapsible) ─── */}
      <div className="border-t lg:border-t-0 lg:border-l overflow-hidden" style={{ borderColor: BRAND.divider, background: BRAND.card }}>
        <div className={`flex items-center cursor-pointer ${activityOpen ? "justify-between p-4 pb-2" : "justify-center p-2 pt-4"}`} onClick={() => setActivityOpen(!activityOpen)}>
          {activityOpen && <h3 className="text-[14px] font-semibold" style={{ color: BRAND.textPrimary }}>Recent Activity</h3>}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ color: BRAND.textTertiary }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {activityOpen ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </div>
        </div>

        <AnimatePresence>
          {activityOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-y-auto px-4 pb-4"
            >
              <div className="flex flex-col">
                {activities.map((a, i) => {
                  const ch = CHANNEL_LABELS[a.channel] || CHANNEL_LABELS.other;
                  return (
                    <div key={a.id} className="flex gap-2.5 pb-3.5 relative">
                      {i < activities.length - 1 && <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ background: BRAND.divider }} />}
                      <div className="w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 mt-[1px]" style={{ background: ch.color + "18" }}>
                        <div className="w-[7px] h-[7px] rounded-full" style={{ background: ch.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: BRAND.textPrimary }}>{a.contact_name}</div>
                        <div className="text-[11px] leading-snug truncate" style={{ color: BRAND.textSecondary }}>{a.notes || a.message_type}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-semibold" style={{ color: ch.color }}>{ch.label}</span>
                          <span className="text-[10px]" style={{ color: BRAND.textTertiary }}>{new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {activities.length === 0 && <span className="text-[12px]" style={{ color: BRAND.textTertiary }}>No activity yet</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
