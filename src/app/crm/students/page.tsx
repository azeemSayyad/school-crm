"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Student } from "@/lib/crm-types";
import { useAuth } from "@/lib/auth-context";
import { CLASS_LIST, ClassBadge, ClassSelector } from "@/components/ClassSelector";

/* ── helpers ── */
const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const getHue = (name: string) =>
  name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

/* ── icons ── */
const PhoneIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const ChatIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const AddIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BackIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

/* ─────────────────────────────────────────
   ADD STUDENT MODAL
───────────────────────────────────────── */
function AddStudentModal({
  onClose,
  onCreated,
  defaultClass,
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultClass?: string;
}) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", standard: defaultClass ?? "", notes: "", total_fees: "", fees_paid: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const s = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready = form.name.trim() && form.phone.trim();

  const submit = async () => {
    if (!ready) return;
    setLoading(true); setError("");
    const { error: err } = await supabase.from("students").insert({
      name: form.name.trim(), phone: form.phone.trim(),
      address: form.address.trim() || null,
      standard: form.standard || null,
      notes: form.notes.trim() || null,
      total_fees: form.total_fees ? parseFloat(form.total_fees) : 0,
      fees_paid: form.fees_paid ? parseFloat(form.fees_paid) : 0,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    onCreated(); onClose();
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[92vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-[17px] font-extrabold text-gray-900">Add Student</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-gray-400">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12.5px] font-medium bg-red-50 border border-red-200 text-red-600">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => s("name", e.target.value)} placeholder="Student's full name"
              className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone <span className="text-red-500">*</span></label>
            <input type="tel" value={form.phone} onChange={(e) => s("phone", e.target.value)} placeholder="+91 98765 43210"
              className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>

          {/* Address */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Address</label>
            <textarea value={form.address} onChange={(e) => s("address", e.target.value)} placeholder="Street, City…" rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>

          {/* Class */}
          <ClassSelector value={form.standard} onChange={(v) => s("standard", v)} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Total Fees</label>
              <input type="number" min={0} value={form.total_fees} onChange={(e) => s("total_fees", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Fees Paid</label>
              <input type="number" min={0} value={form.fees_paid} onChange={(e) => s("fees_paid", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => s("notes", e.target.value)} placeholder="Optional notes…" rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold rounded-[8px] border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">Cancel</button>
          <button onClick={submit} disabled={!ready || loading}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-bold rounded-[8px] bg-[#0170B9] text-white hover:bg-[#0160a5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {loading ? <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg> : null}
            {loading ? "Creating…" : "Create Student"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   STUDENT CARD
───────────────────────────────────────── */
function StudentCard({ student, onNavigate }: { student: Student; onNavigate: (id: string) => void }) {
  return (
    <div
      onClick={() => onNavigate(student.id)}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden p-5 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100/50 shrink-0 shadow-sm"
          >
            {getInitials(student.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-gray-900 truncate leading-tight">{student.name}</p>
            <p className="text-[12px] text-gray-400 mt-0.5 truncate">{student.phone || "—"}</p>
          </div>
        </div>

        {student.standard && (
          <div className="mb-3">
            <ClassBadge value={student.standard} />
          </div>
        )}

        {student.address && (
          <p className="text-[11.5px] text-gray-400 truncate mb-2.5">{student.address}</p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center text-[11px] font-semibold text-gray-500 mb-3.5 bg-gray-50/50 px-3 py-2 rounded-xl border border-gray-100">
          <div>
            <span className="block text-gray-400 text-[9px] uppercase font-bold tracking-wider mb-0.5">Paid</span>
            <span className="text-gray-800 font-bold text-[12.5px]">₹{student.fees_paid ?? 0}</span>
          </div>
          <div className="text-right">
            <span className="block text-gray-400 text-[9px] uppercase font-bold tracking-wider mb-0.5">Balance</span>
            <span className={`font-extrabold text-[12.5px] ${(student.total_fees ?? 0) - (student.fees_paid ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>₹{(student.total_fees ?? 0) - (student.fees_paid ?? 0)}</span>
          </div>
        </div>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <a
            href={`tel:${student.phone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-semibold no-underline transition-colors"
            style={{ background: "rgba(59,130,246,0.06)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.12)" }}
          >
            <PhoneIcon /> Call
          </a>
          <button
            onClick={() => onNavigate(student.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer"
            style={{ background: "rgba(124,58,237,0.06)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.12)" }}
          >
            <ChatIcon /> Chat
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CLASS CARD (shown on the overview grid)
───────────────────────────────────────── */
function ClassCard({
  cls,
  count,
  teacherName,
  onClick,
}: {
  cls: (typeof CLASS_LIST)[number];
  count: number;
  teacherName?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full cursor-pointer"
      style={{ background: "transparent", border: "none", padding: 0 }}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden transition-all duration-200 group-hover:shadow-lg"
        style={{
          background: "#ffffff",
          border: `1.5px solid ${cls.border}50`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}
      >
        {/* Gradient accent bar */}
        <div
          className="h-2 w-full"
          style={{ background: `linear-gradient(90deg, ${cls.dot}, ${cls.border})` }}
        />

        <div className="px-5 pt-5 pb-4">
          {/* Class name row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-black"
                style={{ background: cls.dot + "18", color: cls.dot }}
              >
                {cls.label.replace("Class ", "").slice(0, 3)}
              </div>
              <span className="text-[14px] font-bold text-gray-700">{cls.label}</span>
            </div>
            <svg
              width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="text-gray-300 group-hover:text-gray-500 transition-colors -mr-0.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Count */}
          <div className="flex items-baseline gap-2 mb-3">
            <span
              className="text-[44px] font-black leading-none tracking-tight"
              style={{ color: cls.text }}
            >
              {count}
            </span>
            <span className="text-[13px] font-semibold text-gray-400 pb-1.5">
              {count === 1 ? "student" : "students"}
            </span>
          </div>

          {/* Progress bar showing relative fullness (visual only) */}
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: `linear-gradient(90deg, ${cls.dot}, ${cls.border})`,
                width: count === 0 ? "0%" : `${Math.min(100, (count / 20) * 100)}%`,
                opacity: 0.7,
              }}
            />
          </div>

          {/* Class teacher footer */}
          <div
            className="flex items-center gap-1.5 pt-2 mt-1"
            style={{ borderTop: "1px solid #f3f4f6" }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0" style={{ color: cls.dot }}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[11.5px] font-medium truncate" style={{ color: teacherName ? "#374151" : "#d1d5db" }}>
              {teacherName ?? "No teacher assigned"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
function ViewModeToggle({ mode, onChange }: { mode: "card" | "table"; onChange: (mode: "card" | "table") => void }) {
  return (
    <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
      <button
        onClick={() => onChange("table")}
        className={`px-3 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          mode === "table"
            ? "bg-white text-gray-800 shadow-sm"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        Table
      </button>
      <button
        onClick={() => onChange("card")}
        className={`px-3 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          mode === "card"
            ? "bg-white text-gray-800 shadow-sm"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        Cards
      </button>
    </div>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";

  const [classViewMode, setClassViewMode] = useState<"card" | "table">("table");
  const [studentViewMode, setStudentViewMode] = useState<"card" | "table">("table");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  // Map: classValue -> teacher name (for display on cards)
  const [teacherByClass, setTeacherByClass] = useState<Record<string, string>>({});
  // For teacher role: the classes they are assigned to
  const [myClasses, setMyClasses] = useState<string[] | null>(null); // null = not yet resolved

  /* fetch ALL students once (for counts + class view) */
  const fetchStudents = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);

    const [{ data: studentData }, { data: teacherData }] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, phone, address, standard, created_at, total_fees, fees_paid")
        .order("name", { ascending: true }),
      supabase
        .from("teachers")
        .select("name, assigned_classes, user_id")
        .eq("status", "active"),
    ]);

    if (studentData) setStudents(studentData as Student[]);

    if (teacherData) {
      const map: Record<string, string> = {};
      for (const t of teacherData as { name: string; assigned_classes: string[]; user_id: number | null }[]) {
        for (const cls of (t.assigned_classes ?? [])) {
          if (!map[cls]) map[cls] = t.name;
        }
      }
      setTeacherByClass(map);

      // Resolve this teacher's own assigned classes
      if (user?.role === "teacher") {
        const myRecord = (teacherData as { name: string; assigned_classes: string[]; user_id: string | null }[])
          .find((t) => t.user_id === user.id);
        setMyClasses(myRecord?.assigned_classes ?? []);
      } else {
        setMyClasses(null); // admin/super_admin: no restriction
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  /* visible classes: teacher sees only their classes, admin sees all */
  const visibleClasses = isTeacher && myClasses !== null
    ? CLASS_LIST.filter((c) => myClasses.includes(c.value))
    : CLASS_LIST;

  /* counts per class */
  const countByClass = Object.fromEntries(
    CLASS_LIST.map((c) => [c.value, students.filter((s) => s.standard === c.value).length])
  );
  const unassigned = students.filter((s) => !s.standard);

  /* students shown in class view */
  const classStudents = selectedClass
    ? students.filter((s) => s.standard === selectedClass)
    : [];

  const filtered = search.trim()
    ? classStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.phone ?? "").includes(search)
      )
    : classStudents;

  const selectedCfg = CLASS_LIST.find((c) => c.value === selectedClass);

  /* ── render ── */
  return (
    <div className="min-h-full" style={{ background: "#f5f7fa", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="w-full px-0">

        {/* ── CLASS OVERVIEW ── */}
        {!selectedClass && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Students</h1>
                <p className="text-[13px] text-gray-400">
                  {isTeacher ? (
                    <><span className="font-semibold text-gray-700">{visibleClasses.length}</span> class{visibleClasses.length !== 1 ? "es" : ""} assigned to you</>
                  ) : (
                    <><span className="font-semibold text-gray-700">{students.length}</span> students across <span className="font-semibold text-gray-700">{CLASS_LIST.length}</span> classes</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ViewModeToggle mode={classViewMode} onChange={setClassViewMode} />
                {!isTeacher && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-[13px] font-bold rounded-xl cursor-pointer shadow-md transition-all hover:shadow-lg hover:-translate-y-px"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                  >
                    <AddIcon /> Add Student
                  </button>
                )}
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-24">
                <svg className="animate-spin w-7 h-7" style={{ color: "#4f46e5" }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
                  <path d="M12 2a10 10 0 019.75 7.75" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            )}

            {!loading && (
              <>
                {classViewMode === "table" ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider"># Class</th>
                          <th className="text-left px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Assigned Teacher</th>
                          <th className="text-center px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Students</th>
                          <th className="text-right px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleClasses.map((cls) => {
                          const count = countByClass[cls.value] ?? 0;
                          const teacherName = teacherByClass[cls.value] ?? null;
                          return (
                            <tr
                              key={cls.value}
                              onClick={() => { setSelectedClass(cls.value); setSearch(""); }}
                              className="border-b border-gray-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                            >
                              <td className="px-5 py-3">
                                <div className="flex flex-col justify-center">
                                  <span className="text-[15.5px] font-bold text-gray-900 leading-tight">{cls.label}</span>
                                  <div className="mt-1.5">
                                    <ClassBadge value={cls.value} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex flex-col justify-center">
                                  <span className="text-[15.5px] font-bold text-gray-900 leading-tight">{teacherName ?? "No teacher assigned"}</span>
                                  <span className="text-[13.5px] text-gray-400 font-medium mt-1">Class Teacher</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-[15.5px] font-bold text-gray-900 leading-tight">{count} Active</span>
                                  <span className="mt-1.5 bg-emerald-500 text-white text-[10.5px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase inline-block leading-normal">
                                    ACTIVE
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-blue-600">
                                  View Students
                                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-5 mb-5">
                    {visibleClasses.map((cls) => (
                      <ClassCard
                        key={cls.value}
                        cls={cls}
                        count={countByClass[cls.value] ?? 0}
                        teacherName={teacherByClass[cls.value] ?? null}
                        onClick={() => { setSelectedClass(cls.value); setSearch(""); }}
                      />
                    ))}
                  </div>
                )}

                {/* Unassigned row — only for admin/super_admin */}
                {!isTeacher && unassigned.length > 0 && (
                  <div
                    className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
                    onClick={() => { setSelectedClass("__unassigned__"); setSearch(""); }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                        <UsersIcon />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-gray-800">Unassigned</p>
                        <p className="text-[12px] text-gray-400">No class assigned</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[20px] font-black text-gray-700">{unassigned.length}</span>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── CLASS STUDENT LIST ── */}
        {selectedClass && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <button
                onClick={() => { setSelectedClass(null); setSearch(""); }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer px-2 py-1.5 rounded-lg hover:bg-white -ml-2"
              >
                <BackIcon /> Back
              </button>

              <div className="flex-1 sm:ml-2">
                <div className="flex items-center gap-2.5">
                  {selectedCfg ? (
                    <ClassBadge value={selectedClass} />
                  ) : (
                    <span className="text-[15px] font-extrabold text-gray-800">Unassigned</span>
                  )}
                  <span className="text-[13px] text-gray-400">
                    {filtered.length} student{filtered.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:ml-auto">
                <ViewModeToggle mode={studentViewMode} onChange={setStudentViewMode} />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></span>
                  <input
                    type="text"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:w-48 pl-9 pr-4 py-2 border border-gray-200 rounded-[8px] text-[13px] bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0170B9] text-white text-[13px] font-bold rounded-[8px] hover:bg-[#0160a5] transition-colors cursor-pointer shrink-0"
                >
                  <AddIcon />
                  <span className="hidden sm:inline">Add Student</span>
                </button>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-24">
                <svg className="animate-spin w-6 h-6 text-[#0170B9]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
                  <path d="M12 2a10 10 0 019.75 7.75" stroke="#0170B9" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <UsersIcon />
                </div>
                <p className="text-[14px] font-semibold text-gray-700">No students found</p>
                <p className="text-[13px] text-gray-400 mt-1">
                  {search ? "Try a different search." : "Click \"Add Student\" to add one."}
                </p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              studentViewMode === "table" ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="text-left px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Contact & Address</th>
                          <th className="text-right px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Fees Paid</th>
                          <th className="text-right px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Balance Status</th>
                          <th className="text-center px-5 py-3 text-[13px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s) => {
                          const balance = (s.total_fees ?? 0) - (s.fees_paid ?? 0);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => router.push(`/crm/students/${s.id}`)}
                              className="border-b border-gray-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3.5">
                                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100/30 shrink-0">
                                    {getInitials(s.name)}
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-[15.5px] font-bold text-gray-900 leading-tight">{s.name}</span>
                                    <span className="text-[13.5px] text-gray-400 font-medium mt-1">Class: {s.standard ?? "—"}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex flex-col justify-center">
                                  <span className="text-[15.5px] font-bold text-gray-900 leading-tight">{s.phone || "—"}</span>
                                  <span className="text-[13.5px] text-gray-400 font-medium mt-1 max-w-[220px] truncate">{s.address || "—"}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex flex-col items-end justify-center">
                                  <span className="text-[15.5px] font-bold text-gray-900 leading-tight">₹{s.fees_paid ?? 0}</span>
                                  <span className="text-[13.5px] text-gray-400 font-medium mt-1">Total: ₹{s.total_fees ?? 0}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex flex-col items-end justify-center">
                                  <span className={`text-[15.5px] font-bold leading-tight ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                    ₹{balance}
                                  </span>
                                  <span className={`mt-1.5 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase inline-block leading-normal text-white ${
                                    balance > 0 ? "bg-rose-500" : "bg-emerald-500"
                                  }`}>
                                    {balance > 0 ? "DUE" : "PAID"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-center items-center gap-2">
                                  <a
                                    href={`tel:${s.phone}`}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 transition-colors"
                                  >
                                    <PhoneIcon />
                                  </a>
                                  <button
                                    onClick={() => router.push(`/crm/students/${s.id}`)}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-purple-600 bg-purple-50 hover:bg-purple-100/70 border border-purple-100 transition-colors cursor-pointer"
                                  >
                                    <ChatIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filtered.map((student) => (
                    <StudentCard
                      key={student.id}
                      student={student}
                      onNavigate={(id) => router.push(`/crm/students/${id}`)}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onCreated={fetchStudents}
          defaultClass={selectedClass && selectedClass !== "__unassigned__" ? selectedClass : undefined}
        />
      )}
    </div>
  );
}
