"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Student } from "@/lib/crm-types";
import { CLASS_LIST } from "@/components/ClassSelector";

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

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

interface PaymentModalProps {
  student: Student;
  onClose: () => void;
  onSave: () => void;
}

function PaymentModal({ student, onClose, onSave }: PaymentModalProps) {
  const [totalFees, setTotalFees] = useState(student.total_fees || 0);
  const [feesPaid, setFeesPaid] = useState(student.fees_paid || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          total_fees: Number(totalFees),
          fees_paid: Number(feesPaid),
        })
        .eq("id", student.id);
      if (error) throw error;
      onSave();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start ">
          <div>
            <h3 className="text-[17px] font-extrabold text-gray-900">Record Fee Payment</h3>
            <p className="text-[13px] text-gray-400 mt-1">Student: <span className="font-bold text-gray-700">{student.name}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider ">Total Tuition Fees (₹)</label>
            <input
              type="number"
              value={totalFees}
              onChange={(e) => setTotalFees(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full h-11 px-3 text-[14px] font-bold border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#0170B9] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider ">Fees Paid (₹)</label>
            <input
              type="number"
              value={feesPaid}
              onChange={(e) => setFeesPaid(Math.min(totalFees, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-full h-11 px-3 text-[14px] font-bold border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#0170B9] transition-colors"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {[500, 1000, 2000, 5000].map((amt) => {
                const projected = feesPaid + amt;
                const disabled = projected > totalFees;
                return (
                  <button
                    key={amt}
                    type="button"
                    disabled={disabled}
                    onClick={() => setFeesPaid(Math.min(totalFees, feesPaid + amt))}
                    className={`text-[12px] font-bold px-2.5 py-1 rounded-lg border transition-all ${disabled
                      ? "opacity-40 cursor-not-allowed border-gray-100 text-gray-300"
                      : "border-gray-200 text-gray-600 hover:border-[#0170B9] hover:text-[#0170B9] hover:bg-blue-50/20"
                      }`}
                  >
                    + ₹{amt}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setFeesPaid(totalFees)}
                className="text-[12px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50/30 transition-all ml-auto"
              >
                Pay Full
              </button>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-[13.5px] font-medium text-gray-600 mt-2">
            <span>Remaining Balance:</span>
            <span className={`text-[14.5px] font-black ${totalFees - feesPaid > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              ₹{totalFees - feesPaid}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-50 text-gray-500 text-[13px] font-bold rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#0170B9] hover:bg-[#0160a5] text-white text-[13px] font-bold rounded-lg shadow-sm transition-all"
            >
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FeeTrackingPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "paid" | "due">("all");
  const [search, setSearch] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<Student | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, phone, address, standard, total_fees, fees_paid, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setStudents((data || []) as Student[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, selectedStatus, search]);

  const filtered = students.filter((s) => {
    const classMatch = selectedClass === "all" || s.standard === selectedClass;
    const balance = (s.total_fees ?? 0) - (s.fees_paid ?? 0);
    const statusMatch =
      selectedStatus === "all" ||
      (selectedStatus === "paid" && balance <= 0 && (s.total_fees || 0) > 0) ||
      (selectedStatus === "due" && (balance > 0 || !(s.total_fees)));
    const searchMatch =
      !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone ?? "").includes(search);
    return classMatch && statusMatch && searchMatch;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedStudents = filtered.slice(startIndex, endIndex);

  const totalExpected = students.reduce((acc, curr) => acc + (curr.total_fees || 0), 0);
  const totalPaid = students.reduce((acc, curr) => acc + (curr.fees_paid || 0), 0);
  const totalOutstanding = totalExpected - totalPaid;
  const ratio = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

  return (
    <div className="min-h-full" style={{ background: "#f5f7fa", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="w-full px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-5">
          <div>
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Fee Tracking</h1>
            <p className="text-[13px] text-gray-400">
              Monitor and collect student tuition payments
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Expected</span>
            <span className="text-[18px] sm:text-[22px] font-black text-gray-900 mt-1 sm:mt-2">₹{totalExpected.toLocaleString("en-IN")}</span>
            <span className="text-[11px] text-gray-400 mt-0.5 sm:mt-1">Full tuition projected</span>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Collected</span>
            <span className="text-[18px] sm:text-[22px] font-black text-emerald-600 mt-1 sm:mt-2">₹{totalPaid.toLocaleString("en-IN")}</span>
            <span className="text-[11px] text-gray-400 mt-0.5 sm:mt-1">Realized payments</span>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Outstanding</span>
            <span className="text-[18px] sm:text-[22px] font-black text-rose-600 mt-1 sm:mt-2">₹{totalOutstanding.toLocaleString("en-IN")}</span>
            <span className="text-[11px] text-gray-400 mt-0.5 sm:mt-1">Receivables remaining</span>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Collection Ratio</span>
            <span className="text-[18px] sm:text-[22px] font-black text-blue-600 mt-1 sm:mt-2">{ratio.toFixed(1)}%</span>
            <div className="w-full bg-gray-100 h-1.5 sm:h-2 rounded-full mt-1.5 sm:mt-2.5 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${ratio}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 mb-5">
          <div className="relative w-full md:flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-4 bg-white border border-gray-200 rounded-[10px] text-[13.5px] placeholder-gray-400 font-semibold focus:outline-none focus:border-[#0170B9] transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full sm:w-auto h-11 px-3 bg-white border border-gray-200 rounded-[10px] text-[13.5px] font-bold text-gray-700 focus:outline-none focus:border-[#0170B9] cursor-pointer"
            >
              <option value="all">All Classes</option>
              {CLASS_LIST.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full sm:w-auto h-11 px-3 bg-white border border-gray-200 rounded-[10px] text-[13.5px] font-bold text-gray-700 focus:outline-none focus:border-[#0170B9] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Fully Paid</option>
              <option value="due">Pending Dues</option>
            </select>

            <div className="bg-blue-50/70 text-blue-600 h-11 px-3.5 rounded-[10px] text-[13px] font-bold border border-blue-100 flex items-center justify-center whitespace-nowrap shrink-0 w-full sm:w-auto">
              {totalItems} record{totalItems !== 1 ? "s" : ""}
            </div>
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

        {!loading && totalItems === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center ">
              <UsersIcon />
            </div>
            <p className="text-[14px] font-semibold text-gray-700">No students found matching filters</p>
          </div>
        )}

        {!loading && totalItems > 0 && (
          <>
            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ">
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
                    {paginatedStudents.map((s) => {
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
                              <span className={`mt-1.5 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase inline-block leading-normal text-white ${balance > 0 ? "bg-rose-500" : "bg-emerald-500"
                                }`}>
                                {balance > 0 ? "DUE" : "PAID"}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-center items-center gap-2">
                              <button
                                onClick={() => setPaymentTarget(s)}
                                className="px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 rounded-lg text-[12px] font-bold transition-colors cursor-pointer"
                              >
                                Record Payment
                              </button>
                              <a
                                href={`tel:${s.phone}`}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 transition-colors"
                              >
                                <PhoneIcon />
                              </a>
                              <a
                                href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-100 transition-colors"
                              >
                                <ChatIcon />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4.5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[13.5px] text-gray-500 font-semibold">
                  Showing <span className="font-bold text-gray-800">{startIndex + 1}</span> to <span className="font-bold text-gray-800">{endIndex}</span> of <span className="font-bold text-gray-800">{totalItems}</span> students
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={`px-3.5 py-2 text-[13px] font-bold rounded-lg border transition-all ${currentPage === 1
                      ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50/50"
                      : "border-gray-200 text-gray-700 bg-white hover:border-[#0170B9] hover:text-[#0170B9]"
                      }`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pg = idx + 1;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setCurrentPage(pg)}
                          className={`w-9 h-9 text-[13px] font-extrabold rounded-lg flex items-center justify-center transition-all ${currentPage === pg
                            ? "bg-[#0170B9] text-white"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage === totalPages || totalPages <= 1}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={`px-3.5 py-2 text-[13px] font-bold rounded-lg border transition-all ${currentPage === totalPages || totalPages <= 1
                      ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50/50"
                      : "border-gray-200 text-gray-700 bg-white hover:border-[#0170B9] hover:text-[#0170B9]"
                      }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="block md:hidden space-y-4 ">
              <div className="grid grid-cols-1 gap-4">
                {paginatedStudents.map((s) => {
                  const balance = (s.total_fees ?? 0) - (s.fees_paid ?? 0);
                  return (
                    <div
                      key={s.id}
                      onClick={() => router.push(`/crm/students/${s.id}`)}
                      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100/30 shrink-0">
                            {getInitials(s.name)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[15.5px] font-bold text-gray-900 leading-tight">{s.name}</span>
                            <span className="text-[13.5px] text-gray-400 font-medium mt-0.5">Class: {s.standard ?? "—"}</span>
                          </div>
                        </div>
                        <span className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase inline-block leading-normal text-white ${balance > 0 ? "bg-rose-500" : "bg-emerald-500"
                          }`}>
                          {balance > 0 ? "DUE" : "PAID"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-50 text-[13px]">
                        <div>
                          <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ">Contact & Address</span>
                          <span className="block font-bold text-gray-800">{s.phone || "—"}</span>
                          <span className="block text-gray-400 mt-0.5 truncate max-w-full">{s.address || "—"}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ">Tuition Fees</span>
                          <span className="block font-bold text-gray-800">Paid: ₹{s.fees_paid ?? 0}</span>
                          <span className="block text-gray-400 mt-0.5">Total: ₹{s.total_fees ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Balance Due</span>
                          <span className={`block text-[15.5px] font-black mt-0.5 ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            ₹{balance}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPaymentTarget(s)}
                            className="px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 rounded-lg text-[12px] font-bold transition-colors cursor-pointer"
                          >
                            Record Payment
                          </button>
                          <a
                            href={`tel:${s.phone}`}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 transition-colors"
                          >
                            <PhoneIcon />
                          </a>
                          <a
                            href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-100 transition-colors"
                          >
                            <ChatIcon />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-3 mt-4">
                <span className="text-[12.5px] text-gray-500 font-semibold">
                  Page <span className="font-bold text-gray-800">{currentPage}</span> of <span className="font-bold text-gray-800">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-lg border transition-all ${currentPage === 1
                      ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50/50"
                      : "border-gray-200 text-gray-700 bg-white hover:border-[#0170B9]"
                      }`}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages || totalPages <= 1}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-lg border transition-all ${currentPage === totalPages || totalPages <= 1
                      ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50/50"
                      : "border-gray-200 text-gray-700 bg-white hover:border-[#0170B9]"
                      }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {paymentTarget && (
        <PaymentModal
          student={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSave={() => {
            setPaymentTarget(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
