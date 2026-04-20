"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type {
  Teacher,
  TeacherSalaryPayment,
  TeacherLeave,
  TeacherStatus,
  EmploymentType,
  SalaryFrequency,
  TeacherLeaveType,
  SalaryPaymentMethod,
} from "@/lib/crm-types";
import {
  TEACHER_STATUS_META,
  EMPLOYMENT_TYPES,
  SALARY_FREQUENCIES,
  TEACHER_LEAVE_TYPES,
  SALARY_PAYMENT_METHODS,
} from "@/lib/crm-types";

/* ─── Helpers ─── */

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const getHue = (name: string) =>
  name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const fmtCurrency = (n: number | null) =>
  n == null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAGE_SIZE = 20;

type DrawerTab = "overview" | "salary" | "leaves" | "notes";

/* ─── Add Teacher Modal ─── */
interface AddTeacherModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddTeacherModal({ onClose, onCreated }: AddTeacherModalProps) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    date_of_birth: "",
    department: "",
    subject: "",
    join_date: "",
    employment_type: "full_time" as EmploymentType,
    status: "active" as TeacherStatus,
    base_salary: "",
    salary_frequency: "monthly" as SalaryFrequency,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!isSupabaseConfigured()) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("teachers").insert({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      date_of_birth: form.date_of_birth || null,
      department: form.department.trim() || null,
      subject: form.subject.trim() || null,
      join_date: form.join_date || null,
      employment_type: form.employment_type,
      status: form.status,
      base_salary: form.base_salary ? parseFloat(form.base_salary) : null,
      salary_frequency: form.salary_frequency,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Add Teacher</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {error && <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-1">Personal Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Full Name *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. John Smith" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 000 0000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="john@school.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Address</label>
              <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, City" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
          </div>

          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">Employment Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Department</label>
              <input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Mathematics" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Subject</label>
              <input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Algebra" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Join Date</label>
              <input type="date" value={form.join_date} onChange={(e) => set("join_date", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Employment Type</label>
              <select value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9] cursor-pointer">
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9] cursor-pointer">
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">Salary</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Base Salary ($)</label>
              <input type="number" min="0" value={form.base_salary} onChange={(e) => set("base_salary", e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9]" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Frequency</label>
              <select value={form.salary_frequency} onChange={(e) => set("salary_frequency", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9] cursor-pointer">
                {SALARY_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any additional notes..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9] resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 text-[13px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
            {saving ? "Saving..." : "Add Teacher"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Teacher Detail Drawer ─── */
interface DrawerProps {
  teacher: Teacher;
  onClose: () => void;
  onUpdated: (t: Teacher) => void;
  onDeleted: (id: string) => void;
}

function TeacherDrawer({ teacher, onClose, onUpdated, onDeleted }: DrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Teacher>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Salary tab
  const [salaryPayments, setSalaryPayments] = useState<TeacherSalaryPayment[]>([]);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [showLogPayment, setShowLogPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", method: "bank_transfer" as SalaryPaymentMethod, notes: "" });
  const [loggingPayment, setLoggingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Leaves tab
  const [leaves, setLeaves] = useState<TeacherLeave[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [showLogLeave, setShowLogLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ date: new Date().toISOString().slice(0, 10), leave_type: "sick" as TeacherLeaveType, notes: "" });
  const [loggingLeave, setLoggingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  // Notes tab
  const [notes, setNotes] = useState(teacher.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (tab === "salary") fetchSalaryPayments();
    if (tab === "leaves") fetchLeaves();
  }, [tab]);

  const fetchSalaryPayments = async () => {
    if (!isSupabaseConfigured()) return;
    setLoadingSalary(true);
    const { data } = await supabase
      .from("teacher_salary_payments")
      .select("*")
      .eq("teacher_id", teacher.id)
      .order("date", { ascending: false });
    setSalaryPayments((data as TeacherSalaryPayment[]) ?? []);
    setLoadingSalary(false);
  };

  const fetchLeaves = async () => {
    if (!isSupabaseConfigured()) return;
    setLoadingLeaves(true);
    const { data } = await supabase
      .from("teacher_leaves")
      .select("*")
      .eq("teacher_id", teacher.id)
      .order("date", { ascending: false });
    setLeaves((data as TeacherLeave[]) ?? []);
    setLoadingLeaves(false);
  };

  const startEdit = () => {
    setForm({ ...teacher });
    setEditing(true);
    setSaveError("");
  };

  const cancelEdit = () => { setEditing(false); setSaveError(""); };

  const saveOverview = async () => {
    if (!isSupabaseConfigured() || !form.name?.trim()) return;
    setSaving(true);
    setSaveError("");
    const { data, error } = await supabase
      .from("teachers")
      .update({
        name: form.name?.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        address: form.address?.trim() || null,
        date_of_birth: form.date_of_birth || null,
        department: form.department?.trim() || null,
        subject: form.subject?.trim() || null,
        join_date: form.join_date || null,
        employment_type: form.employment_type,
        status: form.status,
        base_salary: form.base_salary ?? null,
        salary_frequency: form.salary_frequency,
      })
      .eq("id", teacher.id)
      .select()
      .single();
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setEditing(false);
    onUpdated(data as Teacher);
  };

  const logPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { setPaymentError("Enter a valid amount"); return; }
    setLoggingPayment(true);
    setPaymentError("");
    const { error } = await supabase.from("teacher_salary_payments").insert({
      teacher_id: teacher.id,
      date: paymentForm.date,
      amount: parseFloat(paymentForm.amount),
      method: paymentForm.method,
      notes: paymentForm.notes.trim() || null,
    });
    setLoggingPayment(false);
    if (error) { setPaymentError(error.message); return; }
    setShowLogPayment(false);
    setPaymentForm({ date: new Date().toISOString().slice(0, 10), amount: "", method: "bank_transfer", notes: "" });
    fetchSalaryPayments();
  };

  const deletePayment = async (id: string) => {
    await supabase.from("teacher_salary_payments").delete().eq("id", id);
    fetchSalaryPayments();
  };

  const logLeave = async () => {
    setLoggingLeave(true);
    setLeaveError("");
    const { error } = await supabase.from("teacher_leaves").insert({
      teacher_id: teacher.id,
      date: leaveForm.date,
      leave_type: leaveForm.leave_type,
      notes: leaveForm.notes.trim() || null,
    });
    setLoggingLeave(false);
    if (error) { setLeaveError(error.message); return; }
    setShowLogLeave(false);
    setLeaveForm({ date: new Date().toISOString().slice(0, 10), leave_type: "sick", notes: "" });
    fetchLeaves();
  };

  const deleteLeave = async (id: string) => {
    await supabase.from("teacher_leaves").delete().eq("id", id);
    fetchLeaves();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await supabase.from("teachers").update({ notes }).eq("id", teacher.id);
    setSavingNotes(false);
    onUpdated({ ...teacher, notes });
  };

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from("teacher_salary_payments").delete().eq("teacher_id", teacher.id);
    await supabase.from("teacher_leaves").delete().eq("teacher_id", teacher.id);
    await supabase.from("teachers").delete().eq("id", teacher.id);
    setDeleting(false);
    onDeleted(teacher.id);
  };

  const statusMeta = TEACHER_STATUS_META[teacher.status];
  const hue = getHue(teacher.name);

  const totalPaid = salaryPayments.reduce((s, p) => s + p.amount, 0);

  const inputCls = "w-full px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9] bg-white";
  const labelCls = "block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl"
        style={{ width: "min(520px, 100vw)", borderLeft: "1px solid #e5e8ec" }}
      >
        {/* Drawer Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
            style={{ background: `hsl(${hue},65%,50%)` }}
          >
            {getInitials(teacher.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-bold text-gray-900 truncate">{teacher.name}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: statusMeta.color, background: statusMeta.bg }}>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-[12px] text-gray-500 truncate">{teacher.department || "—"}{teacher.subject ? ` · ${teacher.subject}` : ""}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete teacher"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5 shrink-0">
          {(["overview", "salary", "leaves", "notes"] as DrawerTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2.5 text-[12px] font-semibold capitalize cursor-pointer border-b-2 transition-colors"
              style={{
                borderBottomColor: tab === t ? "#0170B9" : "transparent",
                color: tab === t ? "#0170B9" : "#9ca3af",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── OVERVIEW TAB ── */}
          {tab === "overview" && (
            <div className="space-y-4">
              {!editing ? (
                <>
                  <div className="flex justify-end">
                    <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#0170B9] bg-[#e8f4fb] rounded-lg hover:bg-[#d0eaf8] cursor-pointer transition-colors">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                  </div>

                  <section>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoField label="Phone" value={teacher.phone} />
                      <InfoField label="Email" value={teacher.email} />
                      <InfoField label="Address" value={teacher.address} className="col-span-2" />
                      <InfoField label="Date of Birth" value={fmtDate(teacher.date_of_birth)} />
                      <InfoField label="Added" value={fmtDate(teacher.created_at)} />
                    </div>
                  </section>

                  <section>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Employment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoField label="Department" value={teacher.department} />
                      <InfoField label="Subject" value={teacher.subject} />
                      <InfoField label="Join Date" value={fmtDate(teacher.join_date)} />
                      <InfoField label="Type" value={EMPLOYMENT_TYPES.find((e) => e.value === teacher.employment_type)?.label ?? teacher.employment_type} />
                    </div>
                  </section>

                  <section>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Salary</p>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoField label="Base Salary" value={fmtCurrency(teacher.base_salary)} />
                      <InfoField label="Frequency" value={SALARY_FREQUENCIES.find((f) => f.value === teacher.salary_frequency)?.label ?? teacher.salary_frequency} />
                    </div>
                  </section>
                </>
              ) : (
                /* Edit form */
                <div className="space-y-3">
                  {saveError && <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}

                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Personal Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Full Name *</label>
                      <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Address</label>
                      <input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Date of Birth</label>
                      <input type="date" value={form.date_of_birth ?? ""} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} className={inputCls} />
                    </div>
                  </div>

                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-1">Employment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Department</label>
                      <input value={form.department ?? ""} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Subject</label>
                      <input value={form.subject ?? ""} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Join Date</label>
                      <input type="date" value={form.join_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Employment Type</label>
                      <select value={form.employment_type ?? "full_time"} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value as EmploymentType }))} className={inputCls + " cursor-pointer"}>
                        {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <select value={form.status ?? "active"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TeacherStatus }))} className={inputCls + " cursor-pointer"}>
                        <option value="active">Active</option>
                        <option value="on_leave">On Leave</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-1">Salary</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Base Salary ($)</label>
                      <input type="number" min="0" value={form.base_salary ?? ""} onChange={(e) => setForm((f) => ({ ...f, base_salary: e.target.value ? parseFloat(e.target.value) : null }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Frequency</label>
                      <select value={form.salary_frequency ?? "monthly"} onChange={(e) => setForm((f) => ({ ...f, salary_frequency: e.target.value as SalaryFrequency }))} className={inputCls + " cursor-pointer"}>
                        {SALARY_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={cancelEdit} className="flex-1 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Cancel</button>
                    <button onClick={saveOverview} disabled={saving} className="flex-1 py-2 text-[13px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SALARY TAB ── */}
          {tab === "salary" && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f0f7fc] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#0170B9] uppercase tracking-wide mb-1">Base Salary</p>
                  <p className="text-[18px] font-bold text-gray-900">{fmtCurrency(teacher.base_salary)}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{teacher.salary_frequency}</p>
                </div>
                <div className="bg-[#ecfdf5] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#10b981] uppercase tracking-wide mb-1">Total Paid</p>
                  <p className="text-[18px] font-bold text-gray-900">{fmtCurrency(totalPaid)}</p>
                  <p className="text-[11px] text-gray-400">{salaryPayments.length} payment{salaryPayments.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Log payment */}
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-gray-700">Payment History</p>
                <button onClick={() => setShowLogPayment(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 cursor-pointer transition-opacity">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                  Log Payment
                </button>
              </div>

              {showLogPayment && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                  {paymentError && <p className="text-[12px] text-red-600">{paymentError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Amount ($)</label>
                      <input type="number" min="0" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Method</label>
                      <select value={paymentForm.method} onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as SalaryPaymentMethod }))} className={inputCls + " cursor-pointer"}>
                        {SALARY_PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Notes</label>
                      <input value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={inputCls} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowLogPayment(false)} className="flex-1 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">Cancel</button>
                    <button onClick={logPayment} disabled={loggingPayment} className="flex-1 py-1.5 text-[12px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                      {loggingPayment ? "Saving..." : "Save Payment"}
                    </button>
                  </div>
                </div>
              )}

              {loadingSalary ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[#0170B9] border-t-transparent rounded-full animate-spin" /></div>
              ) : salaryPayments.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-gray-400">No payments logged yet.</div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Amount</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Method</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Notes</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryPayments.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(p.date)}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{fmtCurrency(p.amount)}</td>
                          <td className="px-3 py-2 text-gray-500 capitalize">{p.method.replace("_", " ")}</td>
                          <td className="px-3 py-2 text-gray-400 truncate max-w-[100px]">{p.notes ?? "—"}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => deletePayment(p.id)} className="text-gray-300 hover:text-red-400 cursor-pointer transition-colors">
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── LEAVES TAB ── */}
          {tab === "leaves" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                {TEACHER_LEAVE_TYPES.map((lt) => {
                  const count = leaves.filter((l) => l.leave_type === lt.value).length;
                  return (
                    <div key={lt.value} className="rounded-xl p-3 border border-gray-100" style={{ background: lt.bg }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: lt.color }}>{lt.label}</p>
                      <p className="text-[20px] font-bold text-gray-900">{count}</p>
                      <p className="text-[11px] text-gray-400">day{count !== 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-gray-700">Leave Log</p>
                <button onClick={() => setShowLogLeave(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 cursor-pointer transition-opacity">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                  Log Leave
                </button>
              </div>

              {showLogLeave && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                  {leaveError && <p className="text-[12px] text-red-600">{leaveError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={leaveForm.date} onChange={(e) => setLeaveForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Leave Type</label>
                      <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value as TeacherLeaveType }))} className={inputCls + " cursor-pointer"}>
                        {TEACHER_LEAVE_TYPES.map((lt) => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Notes</label>
                      <input value={leaveForm.notes} onChange={(e) => setLeaveForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={inputCls} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowLogLeave(false)} className="flex-1 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">Cancel</button>
                    <button onClick={logLeave} disabled={loggingLeave} className="flex-1 py-1.5 text-[12px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                      {loggingLeave ? "Saving..." : "Save Leave"}
                    </button>
                  </div>
                </div>
              )}

              {loadingLeaves ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[#0170B9] border-t-transparent rounded-full animate-spin" /></div>
              ) : leaves.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-gray-400">No leaves logged yet.</div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Notes</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((l) => {
                        const meta = TEACHER_LEAVE_TYPES.find((lt) => lt.value === l.leave_type)!;
                        return (
                          <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(l.date)}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-400 truncate max-w-[140px]">{l.notes ?? "—"}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => deleteLeave(l.id)} className="text-gray-300 hover:text-red-400 cursor-pointer transition-colors">
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES TAB ── */}
          {tab === "notes" && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400">Free-form notes about this teacher. Saved to their profile.</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={10}
                placeholder="Write notes here..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0170B9]/20 focus:border-[#0170B9] resize-none"
              />
              <button onClick={saveNotes} disabled={savingNotes} className="px-4 py-2 text-[13px] font-semibold text-white bg-[#0170B9] rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          )}
        </div>

        {/* Delete Confirm */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <p className="text-[15px] font-bold text-gray-900 mb-1">Delete Teacher?</p>
              <p className="text-[13px] text-gray-500 mb-4">This will permanently delete <strong>{teacher.name}</strong> and all their salary/leave records. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 text-[13px] font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 cursor-pointer">
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoField({ label, value, className = "" }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[13px] text-gray-800">{value || "—"}</p>
    </div>
  );
}

/* ─── Main Page ─── */

export default function TeachersPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "super_admin";

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TeacherStatus>("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [sortBy, statusFilter]);

  const fetchTeachers = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("teachers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: sortBy === "oldest" });

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (debouncedSearch) query = query.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (!error && data) {
      setTeachers(data as Teacher[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [page, debouncedSearch, sortBy, statusFilter]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  // Realtime
  const fetchRef = useRef(fetchTeachers);
  useEffect(() => { fetchRef.current = fetchTeachers; }, [fetchTeachers]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refetch = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => fetchRef.current(), 400);
    };
    const ch = supabase.channel("teachers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "teachers" }, refetch)
      .subscribe();
    return () => { if (pending) clearTimeout(pending); supabase.removeChannel(ch); };
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleUpdated = (updated: Teacher) => {
    setTeachers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTeacher(updated);
  };

  const handleDeleted = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setSelectedTeacher(null);
  };

  return (
    <div className="min-h-screen bg-[var(--c-bg)] font-['DM_Sans']">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[19px] font-extrabold text-[var(--c-text)]">Teachers</h1>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-0.5">
              {totalCount} teacher{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-[7px] bg-[var(--c-accent)] text-white text-[13px] font-semibold rounded-[7px] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Add Teacher
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]" width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 focus:border-[var(--c-accent)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | TeacherStatus)}
            className="px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="terminated">Terminated</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[var(--c-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && teachers.length === 0 && (
          <div className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--c-bg)] flex items-center justify-center">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--c-text-muted)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><circle cx="10" cy="7" r="4" />
                <path d="M22 8l-3 3-1.5-1.5" />
              </svg>
            </div>
            <p className="text-[13px] text-[var(--c-text)] font-semibold">No teachers found</p>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-1">
              {debouncedSearch || statusFilter !== "all" ? "Try adjusting your filters." : "Click \"Add Teacher\" to add your first teacher."}
            </p>
          </div>
        )}

        {/* Desktop Table */}
        {!loading && teachers.length > 0 && (
          <div className="hidden md:block bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--c-border-light)]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Teacher</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Department / Subject</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Base Salary</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => {
                  const hue = getHue(teacher.name);
                  const statusMeta = TEACHER_STATUS_META[teacher.status];
                  const empType = EMPLOYMENT_TYPES.find((e) => e.value === teacher.employment_type)?.label ?? teacher.employment_type;
                  return (
                    <tr
                      key={teacher.id}
                      onClick={() => setSelectedTeacher(teacher)}
                      className="border-b border-[var(--c-border-light)] last:border-0 hover:bg-[var(--c-bg)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: `hsl(${hue},65%,50%)` }}>
                            {getInitials(teacher.name)}
                          </div>
                          <span className="text-[13px] font-semibold text-[var(--c-text)]">{teacher.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] text-[var(--c-text)]">{teacher.department || "—"}</p>
                        {teacher.subject && <p className="text-[11px] text-[var(--c-text-muted)]">{teacher.subject}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] text-[var(--c-text)]">{teacher.phone || "—"}</p>
                        {teacher.email && <p className="text-[11px] text-[var(--c-text-muted)]">{teacher.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--c-text-muted)]">{empType}</td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-[var(--c-text)]">{fmtCurrency(teacher.base_salary)}</p>
                        {teacher.base_salary && <p className="text-[11px] text-[var(--c-text-muted)] capitalize">{teacher.salary_frequency}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: statusMeta.color, background: statusMeta.bg }}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--c-text-muted)] whitespace-nowrap">{fmtDate(teacher.join_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards */}
        {!loading && teachers.length > 0 && (
          <div className="md:hidden space-y-2">
            {teachers.map((teacher) => {
              const hue = getHue(teacher.name);
              const statusMeta = TEACHER_STATUS_META[teacher.status];
              return (
                <div
                  key={teacher.id}
                  onClick={() => setSelectedTeacher(teacher)}
                  className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] p-4 cursor-pointer hover:border-[var(--c-accent)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: `hsl(${hue},65%,50%)` }}>
                      {getInitials(teacher.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-[var(--c-text)]">{teacher.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: statusMeta.color, background: statusMeta.bg }}>{statusMeta.label}</span>
                      </div>
                      <p className="text-[12px] text-[var(--c-text-muted)]">{teacher.department || "—"}{teacher.subject ? ` · ${teacher.subject}` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold text-[var(--c-text)]">{fmtCurrency(teacher.base_salary)}</p>
                      <p className="text-[11px] text-[var(--c-text-muted)] capitalize">{teacher.salary_frequency}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--c-border)]">
            <p className="text-[12px] text-[var(--c-text-muted)]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-[12px] font-medium border border-[var(--c-border)] rounded-lg text-[var(--c-text-muted)] hover:bg-[var(--c-bg)] disabled:opacity-40 cursor-pointer"
              >Previous</button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-[12px] font-medium border border-[var(--c-border)] rounded-lg text-[var(--c-text-muted)] hover:bg-[var(--c-bg)] disabled:opacity-40 cursor-pointer"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddTeacherModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); fetchTeachers(); }}
        />
      )}

      {selectedTeacher && (
        <TeacherDrawer
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
