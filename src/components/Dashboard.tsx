"use client";

import { STAGES, STAGE_META, SOURCES, type Lead } from "@/lib/types";
import { fmtFull, fmtDT } from "@/lib/utils";
import { Avatar } from "./ui";

export default function Dashboard({ leads }: { leads: Lead[] }) {
  const now = new Date();
  const thisMonth = leads.filter((l) => {
    const d = new Date(l.dateAdded);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const booked = leads.filter((l) => ["Appointment Booked", "Enrolled"].includes(l.stage)).length;
  const conv = leads.length ? ((booked / leads.length) * 100).toFixed(0) : "0";
  const withAppt = leads.filter((l) => l.appointmentDate && l.dateAdded);
  const avgD = withAppt.length
    ? (withAppt.reduce((s, l) => s + Math.max(0, (new Date(l.appointmentDate!).getTime() - new Date(l.dateAdded).getTime()) / 864e5), 0) / withAppt.length).toFixed(1)
    : "—";
  const enrolled = leads.filter((l) => l.stage === "Enrolled").length;
  const noShows = leads.filter((l) => l.stage === "No Show").length;
  const noShowRate = leads.length ? ((noShows / leads.length) * 100).toFixed(0) : "0";
  const enC = leads.filter((l) => l.language === "EN").length;
  const esC = leads.filter((l) => l.language === "ES").length;

  const funnelStages = ["New Lead", "AI Studented", "Pre-Qualifying", "Qualified", "Appointment Booked", "Enrolled"] as const;
  const funnelCounts = funnelStages.map((s, i) => {
    if (i === 0) return leads.length;
    const laterStages = funnelStages.slice(i);
    return leads.filter((l) => laterStages.includes(l.stage as typeof funnelStages[number]) || STAGES.indexOf(l.stage) >= STAGES.indexOf(s)).length;
  });
  const funnelMax = Math.max(funnelCounts[0], 1);

  const sourceData = SOURCES.map((src) => {
    const sl = leads.filter((l) => l.source === src);
    const sb = sl.filter((l) => ["Appointment Booked", "Enrolled"].includes(l.stage)).length;
    return { source: src, total: sl.length, booked: sb, rate: sl.length ? Math.round((sb / sl.length) * 100) : 0 };
  }).sort((a, b) => b.total - a.total);
  const maxSrcTotal = Math.max(...sourceData.map((s) => s.total), 1);

  const upcoming = leads
    .filter((l) => l.appointmentDate && new Date(l.appointmentDate) >= now && l.stage === "Appointment Booked")
    .sort((a, b) => new Date(a.appointmentDate!).getTime() - new Date(b.appointmentDate!).getTime())
    .slice(0, 5);

  const actMeta: Record<string, { type: string; verb: string; color: string }> = {
    "Appointment Booked": { type: "booked", verb: "Appointment booked", color: "#059669" },
    Enrolled: { type: "enrolled", verb: "Enrolled", color: "#16a34a" },
    "New Lead": { type: "new", verb: "New lead", color: "#6366f1" },
    "No Show": { type: "noshow", verb: "Missed appointment", color: "#ef4444" },
    Qualified: { type: "qualified", verb: "Passed qualification", color: "#10b981" },
    "AI Studented": { type: "contacted", verb: "AI outreach sent", color: "#3b82f6" },
    "Not Qualified": { type: "disqualified", verb: "Did not qualify", color: "#dc2626" },
    "Pre-Qualifying": { type: "qualifying", verb: "Qualification in progress", color: "#f59e0b" },
  };
  const activities = leads
    .map((l) => ({ name: l.name, source: l.source, date: l.dateAdded, ...(actMeta[l.stage] || { type: "other", verb: l.stage, color: "#9ca3af" }) }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 14);

  const weekData = (() => {
    const weeks: { label: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const ws = new Date(now); ws.setDate(ws.getDate() - (i * 7 + ws.getDay()));
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      const count = leads.filter((l) => { const d = new Date(l.dateAdded); return d >= ws && d < we; }).length;
      weeks.push({ label: ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count });
    }
    return weeks;
  })();
  const maxW = Math.max(...weekData.map((w) => w.count), 1);

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] p-3.5 md:p-[16px_18px] ${className}`}>{children}</div>
  );
  const CTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[12.5px] font-bold text-[var(--c-text)] mb-3.5">{children}</div>
  );

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_290px] gap-0 h-full overflow-hidden" style={{ margin: "-12px -12px" }}>
      {/* LEFT: Analytics */}
      <div className="p-3 md:p-7 overflow-y-auto">
        {/* Stat Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3 mb-5">
          {[
            { label: "Total Leads", val: leads.length, sub: `${thisMonth.length} this month` },
            { label: "Conversion", val: `${conv}%`, sub: "Lead to Booked", accent: "var(--c-accent)" },
            { label: "Avg. Days", val: avgD, sub: "Lead to Appointment" },
            { label: "Enrolled", val: enrolled, sub: `of ${leads.length} total`, accent: "#16a34a" },
            { label: "No-Show Rate", val: `${noShowRate}%`, sub: `${noShows} missed`, accent: noShows > 0 ? "#ef4444" : "#16a34a" },
          ].map((s, i) => (
            <Card key={i}>
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--c-text-muted)]">{s.label}</div>
              <div className="text-xl md:text-[26px] font-extrabold tracking-tight leading-none mt-1" style={{ color: s.accent || "var(--c-text)" }}>{s.val}</div>
              <div className="text-[11px] text-[var(--c-text-muted)] mt-[3px]">{s.sub}</div>
            </Card>
          ))}
        </div>

        {/* Funnel */}
        <Card className="mb-5">
          <CTitle>Enrollment Funnel</CTitle>
          <div className="flex flex-col gap-1.5">
            {funnelStages.map((stage, i) => {
              const count = funnelCounts[i];
              const pct = (count / funnelMax) * 100;
              const drop = i > 0 ? funnelCounts[i - 1] - count : 0;
              const dropPct = i > 0 && funnelCounts[i - 1] > 0 ? Math.round((drop / funnelCounts[i - 1]) * 100) : 0;
              const sm = STAGE_META[stage];
              return (
                <div key={stage}>
                  {i > 0 && drop > 0 && (
                    <div className="flex items-center py-0.5 gap-[5px] pl-2 md:pl-[118px]">
                      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2L5 8M3 6L5 8L7 6" stroke="#ef4444" strokeWidth="1.2" fill="none" strokeLinecap="round" /></svg>
                      <span className="text-[10px] text-red-500 font-semibold">-{drop} ({dropPct}% drop-off)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-[10px] md:text-[11px] text-[var(--c-text-secondary)] w-[80px] md:w-[120px] text-right shrink-0 font-medium">{stage}</span>
                    <div className="flex-1">
                      <div className="h-[22px] md:h-[26px] bg-[var(--c-bg-subtle)] rounded-[5px] overflow-hidden">
                        <div className="h-full rounded-[5px] flex items-center justify-end transition-all duration-[600ms]"
                          style={{ background: `linear-gradient(90deg, ${sm.color}, ${sm.color}cc)`, width: `${Math.max(pct, count > 0 ? 5 : 0)}%`, paddingRight: count > 0 ? 8 : 0 }}>
                          {count > 0 && <span className="text-[10.5px] font-bold text-white">{count}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--c-text-muted)] w-[34px] text-right">{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <Card>
            <CTitle>Source Performance</CTitle>
            <div className="flex flex-col gap-3">
              {sourceData.map(({ source, total, booked: bk, rate }) => (
                <div key={source}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-[var(--c-text)]">{source}</span>
                    <span className="text-[11px] font-bold" style={{ color: rate >= 30 ? "#16a34a" : rate >= 15 ? "#f59e0b" : "var(--c-text-muted)" }}>{rate}%</span>
                  </div>
                  <div className="h-[5px] bg-[var(--c-bg-subtle)] rounded-[3px] overflow-hidden">
                    <div className="h-full rounded-[3px] bg-[var(--c-accent)] transition-all duration-500" style={{ width: `${(total / maxSrcTotal) * 100}%` }} />
                  </div>
                  <div className="flex justify-between mt-[3px]">
                    <span className="text-[10px] text-[var(--c-text-muted)]">{total} leads</span>
                    <span className="text-[10px] text-[var(--c-text-muted)]">{bk} booked</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CTitle>Leads per Week</CTitle>
            <svg width="100%" height="140" viewBox="0 0 240 140" preserveAspectRatio="xMidYMid meet" className="block">
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1="0" y1={12 + i * 28} x2="240" y2={12 + i * 28} stroke="var(--c-border)" strokeWidth="0.5" strokeDasharray="3,3" />
              ))}
              <path d={(() => {
                const pts = weekData.map((w, i) => [30 + i * (180 / Math.max(weekData.length - 1, 1)), 110 - (w.count / maxW) * 85]);
                return `M${pts[0][0]},${pts[0][1]} ${pts.slice(1).map((p) => `L${p[0]},${p[1]}`).join(" ")} L${pts[pts.length - 1][0]},110 L${pts[0][0]},110 Z`;
              })()} fill="var(--c-accent)" opacity="0.07" />
              <polyline points={weekData.map((w, i) => `${30 + i * (180 / Math.max(weekData.length - 1, 1))},${110 - (w.count / maxW) * 85}`).join(" ")}
                fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {weekData.map((w, i) => {
                const x = 30 + i * (180 / Math.max(weekData.length - 1, 1));
                const y = 110 - (w.count / maxW) * 85;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="3.5" fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth="2" />
                    <text x={x} y={y - 9} textAnchor="middle" fontSize="10" fill="var(--c-text)" fontWeight="700" fontFamily="'DM Sans', sans-serif">{w.count}</text>
                    <text x={x} y={128} textAnchor="middle" fontSize="9" fill="var(--c-text-muted)" fontFamily="'DM Sans', sans-serif">{w.label}</text>
                  </g>
                );
              })}
            </svg>
          </Card>

          <Card>
            <CTitle>Language Split</CTitle>
            <div className="flex rounded-[6px] overflow-hidden h-[26px] mb-2">
              <div className="flex items-center justify-center bg-[var(--c-accent)]" style={{ flex: enC || 0.01 }}>
                <span className="text-[10.5px] font-bold text-white">EN {enC}</span>
              </div>
              <div className="flex items-center justify-center" style={{ flex: esC || 0.01, background: "#f59e0b" }}>
                <span className="text-[10.5px] font-bold text-white">ES {esC}</span>
              </div>
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-[10.5px] text-[var(--c-text-muted)]">{leads.length > 0 ? Math.round((enC / leads.length) * 100) : 0}%</span>
              <span className="text-[10.5px] text-[var(--c-text-muted)]">{leads.length > 0 ? Math.round((esC / leads.length) * 100) : 0}%</span>
            </div>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <Card className="mb-5 lg:mb-0">
          <CTitle>Upcoming Appointments</CTitle>
          {upcoming.length === 0 && <div className="text-xs text-[var(--c-text-muted)] py-1.5">No upcoming appointments</div>}
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
            {upcoming.map((l) => (
              <div key={l.id} className="flex items-center gap-2.5 p-[10px_12px] bg-[var(--c-bg-subtle)] rounded-lg border border-[var(--c-border-light)]">
                <Avatar name={l.name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-[650] text-[var(--c-text)] whitespace-nowrap overflow-hidden text-ellipsis">{l.name}</div>
                  <div className="text-[11px] text-[var(--c-text-muted)]">{fmtDT(l.appointmentDate)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RIGHT: Activity Feed */}
      <div className="bg-[var(--c-bg-subtle)] border-t lg:border-t-0 lg:border-l border-[var(--c-border)] p-4 md:p-[24px_16px] overflow-y-auto">
        <div className="text-[12.5px] font-bold text-[var(--c-text)] mb-4">Recent Activity</div>
        <div className="flex flex-col">
          {activities.map((a, i) => (
            <div key={i} className="flex gap-2.5 pb-3.5 relative">
              {i < activities.length - 1 && <div className="absolute left-[9px] top-5 bottom-0 w-px bg-[var(--c-border)]" />}
              <div className="w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 mt-[1px]" style={{ background: a.color + "18" }}>
                <div className="w-[7px] h-[7px] rounded-full" style={{ background: a.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-[650] text-[var(--c-text)] whitespace-nowrap overflow-hidden text-ellipsis">{a.name}</div>
                <div className="text-[11.5px] text-[var(--c-text-secondary)] leading-[1.3]">{a.verb}{a.type === "new" ? ` via ${a.source}` : ""}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-[var(--c-text-muted)]">{fmtFull(a.date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
