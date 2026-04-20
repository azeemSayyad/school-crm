"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Student } from "@/lib/crm-types";
import MessagingModal from "@/components/MessagingModal";
import { useAuth } from "@/lib/auth-context";

const PAGE_SIZE = 20;

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getHue = (name: string) =>
  name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export default function StudentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canDeleteStudents = user?.role !== "teacher";

  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [messagingStudent, setMessagingStudent] = useState<Student | null>(null);
  const [messagingChannel, setMessagingChannel] = useState<"sms" | "whatsapp">("sms");

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    phone: "",
    address: "",
    standard: "",
    notes: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [sortBy]);

  const fetchStudents = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const orderAsc = sortBy === "oldest";

    let query = supabase
      .from("students")
      .select("id, name, phone, address, standard, created_at", { count: "exact" })
      .order("created_at", { ascending: orderAsc });

    if (debouncedSearch) {
      query = query.or(
        `name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (!error && data) {
      setStudents(data as Student[]);
      setTotalCount(count ?? 0);
    }

    setLoading(false);
  }, [page, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const fetchStudentsRef = useRef(fetchStudents);
  useEffect(() => { fetchStudentsRef.current = fetchStudents; }, [fetchStudents]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refetch = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { fetchStudentsRef.current(); }, 400);
    };
    const channel = supabase
      .channel("students-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, refetch)
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === students.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map((s) => s.id)));
    }
  };

  const bulkDelete = async () => {
    if (!isSupabaseConfigured() || selected.size === 0 || !canDeleteStudents) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    await supabase.from("student_programs").delete().in("student_id", ids);
    await supabase.from("student_payments").delete().in("student_id", ids);
    await supabase.from("student_documents").delete().in("student_id", ids);
    await supabase.from("activity_log").delete().in("student_id", ids);
    await supabase.from("messages").delete().in("student_id", ids);
    await supabase.from("appointments").delete().in("student_id", ids);
    await supabase.from("students").delete().in("id", ids);
    setSelected(new Set());
    setShowBulkDeleteConfirm(false);
    setBulkDeleting(false);
    fetchStudents();
  };

  const handleCreateStudent = async () => {
    if (!newStudent.name || !newStudent.phone) return;
    setCreateLoading(true);
    setCreateError("");

    try {
      const { data, error } = await supabase
        .from("students")
        .insert({
          name: newStudent.name.trim(),
          phone: newStudent.phone.trim(),
          address: newStudent.address.trim() || null,
          standard: newStudent.standard.trim() || null,
          notes: newStudent.notes.trim() || null,
        })
        .select()
        .single();

      if (error) {
        setCreateError(error.message || "Failed to create student");
      } else if (data) {
        setShowAddModal(false);
        setCreateError("");
        setNewStudent({ name: "", phone: "", address: "", standard: "", notes: "" });
        fetchStudents();
      }
    } catch {
      setCreateError("Failed to create student");
    }
    setCreateLoading(false);
  };

  return (
    <div className="min-h-screen min-w-[375px] bg-[var(--c-bg)] font-['DM_Sans']">
      <div className="max-w-[1400px] mx-auto px-2 sm:px-3 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[19px] font-extrabold text-[var(--c-text)]">Students</h1>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-0.5">
              {totalCount} student{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-[7px] bg-[var(--c-accent)] text-white text-[13px] font-semibold rounded-[7px] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Add Student
          </button>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 focus:border-[var(--c-accent)]"
            />
          </div>
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
        {!loading && students.length === 0 && (
          <div className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--c-bg-subtle)] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[13px] text-[var(--c-text-secondary)] font-semibold">No students found</p>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-1">
              {debouncedSearch ? "Try adjusting your search." : "Click \"Add Student\" to create your first student."}
            </p>
          </div>
        )}

        {/* Desktop Table */}
        {!loading && students.length > 0 && (
          <div className="hidden md:block bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--c-border-light)]">
                    <th className="w-10 px-4 py-1.5 text-left">
                      <input
                        type="checkbox"
                        checked={students.length > 0 && selected.size === students.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-[var(--c-border)] accent-[var(--c-accent)] cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Name</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Phone</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Address</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Standard</th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const hue = getHue(student.name);
                    return (
                      <tr
                        key={student.id}
                        className="border-b border-[var(--c-border-light)] last:border-b-0 hover:bg-[var(--c-bg)] transition-colors cursor-pointer"
                        onClick={() => router.push(`/crm/students/${student.id}`)}
                      >
                        <td className="w-10 px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(student.id)}
                            onChange={() => toggleSelect(student.id)}
                            className="w-4 h-4 rounded border-[var(--c-border)] accent-[var(--c-accent)] cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                              style={{ backgroundColor: `hsl(${hue}, 55%, 55%)` }}
                            >
                              {getInitials(student.name)}
                            </div>
                            <span className="text-[13px] font-semibold text-[var(--c-text)] truncate max-w-[180px]">
                              {student.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-[13px] text-[var(--c-text-secondary)]">{student.phone}</td>
                        <td className="px-3 py-1.5 text-[13px] text-[var(--c-text-secondary)] max-w-[200px] truncate">
                          {student.address ?? "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 text-[13px] text-[var(--c-text-secondary)]">
                          {student.standard ?? "\u2014"}
                        </td>
                        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 justify-center whitespace-nowrap">
                            <a
                              href={`tel:${student.phone}`}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors hover:opacity-80 no-underline"
                              style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                              title="Call"
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                              </svg>
                              Call
                            </a>
                            <button
                              onClick={() => { setMessagingChannel("sms"); setMessagingStudent(student); }}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors hover:opacity-80"
                              style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                              SMS
                            </button>
                            <button
                              onClick={() => { setMessagingChannel("whatsapp"); setMessagingStudent(student); }}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors hover:opacity-80"
                              style={{ background: "rgba(37,211,102,0.12)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                              WhatsApp
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
        )}

        {/* Mobile Cards */}
        {!loading && students.length > 0 && (
          <div className="md:hidden flex flex-col gap-3">
            {students.map((student) => {
              const hue = getHue(student.name);
              return (
                <div
                  key={student.id}
                  className="relative bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] p-4 cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => router.push(`/crm/students/${student.id}`)}
                >
                  <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(student.id)}
                      onChange={() => toggleSelect(student.id)}
                      className="w-4 h-4 rounded border-[var(--c-border)] accent-[var(--c-accent)] cursor-pointer"
                    />
                  </div>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: `hsl(${hue}, 55%, 55%)` }}
                    >
                      {getInitials(student.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-semibold text-[var(--c-text)] truncate block pr-6">
                        {student.name}
                      </span>
                      <p className="text-[13px] text-[var(--c-text-secondary)] mt-0.5">{student.phone}</p>
                      {student.address && (
                        <p className="text-[12px] text-[var(--c-text-muted)] mt-0.5 truncate">{student.address}</p>
                      )}
                      {student.standard && (
                        <p className="text-[12px] text-[var(--c-text-muted)] mt-0.5">Class: {student.standard}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${student.phone}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors no-underline"
                          style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                          </svg>
                          Call
                        </a>
                        <button
                          onClick={() => { setMessagingChannel("sms"); setMessagingStudent(student); }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                          style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                          SMS
                        </button>
                        <button
                          onClick={() => { setMessagingChannel("whatsapp"); setMessagingStudent(student); }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                          style={{ background: "rgba(37,211,102,0.12)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-[7px] text-[13px] font-semibold rounded-[7px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--c-bg)] transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="text-[13px] text-[var(--c-text-secondary)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-[7px] text-[13px] font-semibold rounded-[7px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--c-bg)] transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] shadow-lg z-40">
          <div className="max-w-[1400px] mx-auto px-2 sm:px-3 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-semibold text-[var(--c-text)]">{selected.size} selected</span>
            <div className="h-4 w-px bg-[var(--c-border)]" />
            {canDeleteStudents && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="px-3 py-[7px] text-[13px] font-semibold rounded-[7px] border border-red-300 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-[7px] text-[13px] text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition-colors cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/50" onClick={() => setShowBulkDeleteConfirm(false)} />
          <div className="fixed z-[301] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[400px] rounded-2xl shadow-2xl p-6" style={{ background: "var(--c-surface)" }}>
            <h3 className="text-[16px] font-extrabold text-[var(--c-text)] mb-2">Delete {selected.size} student{selected.size !== 1 ? "s" : ""}?</h3>
            <p className="text-[13px] text-[var(--c-text-muted)] mb-6">This will permanently delete the selected students and all their associated data. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkDeleteConfirm(false)} disabled={bulkDeleting} className="px-4 py-2 text-[13px] font-semibold rounded-[7px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={bulkDelete} disabled={bulkDeleting} className="px-4 py-2 text-[13px] font-semibold rounded-[7px] bg-red-600 text-white cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {bulkDeleting && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
                {bulkDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); setCreateError(""); } }}
        >
          <div className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-[var(--c-border-light)]">
              <h2 className="text-[19px] font-extrabold text-[var(--c-text)]">Add Student</h2>
              <button
                onClick={() => { setShowAddModal(false); setCreateError(""); }}
                className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-[var(--c-bg-subtle)] transition-colors text-[var(--c-text-muted)] cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            {createError && (
              <div className="mx-5 mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444" }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                {createError}
              </div>
            )}

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 focus:border-[var(--c-accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 focus:border-[var(--c-accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-1.5">Address</label>
                <textarea
                  value={newStudent.address}
                  onChange={(e) => setNewStudent((s) => ({ ...s, address: e.target.value }))}
                  placeholder="Street address, city, etc."
                  rows={2}
                  className="w-full px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-1.5">Standard / Class</label>
                <input
                  type="text"
                  value={newStudent.standard}
                  onChange={(e) => setNewStudent((s) => ({ ...s, standard: e.target.value }))}
                  placeholder="e.g. 10th Grade"
                  className="w-full px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 focus:border-[var(--c-accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-1.5">Notes</label>
                <textarea
                  value={newStudent.notes}
                  onChange={(e) => setNewStudent((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full px-3 py-[7px] border border-[var(--c-border)] rounded-[7px] text-[13px] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-[var(--c-border-light)]">
              <button
                onClick={() => { setShowAddModal(false); setCreateError(""); }}
                className="px-4 py-[7px] text-[13px] font-semibold rounded-[7px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-bg)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStudent}
                disabled={createLoading || !newStudent.name || !newStudent.phone}
                className="inline-flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold rounded-[7px] bg-[var(--c-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {createLoading && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                    <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {createLoading ? "Creating..." : "Create Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messaging modal */}
      {messagingStudent && (
        <MessagingModal
          student={{
            id: messagingStudent.id,
            name: messagingStudent.name,
            phone: messagingStudent.phone,
            email: messagingStudent.email,
            language: messagingStudent.language,
          }}
          initialChannel={messagingChannel}
          onClose={() => setMessagingStudent(null)}
        />
      )}
    </div>
  );
}
