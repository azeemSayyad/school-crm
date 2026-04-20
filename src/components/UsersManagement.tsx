"use client";

import { useState, useEffect, useCallback } from "react";
import { Btn } from "./ui";
import { Icons } from "./Icons";

interface CrmUser {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: "Super Admin", color: "#6366f1", bg: "#eef2ff" },
  admin:       { label: "Admin",       color: "#3b82f6", bg: "#eff6ff" },
  teacher:     { label: "Teacher",     color: "#10b981", bg: "#ecfdf5" },
};

export default function UsersManagement() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalForm, setModalForm] = useState({ username: "", password: "", role: "teacher" });
  const [modalEditId, setModalEditId] = useState<number | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const [deleteUser, setDeleteUser] = useState<CrmUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/crm/users", { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.users) setUsers(json.users);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setModalMode("create");
    setModalForm({ username: "", password: "", role: "teacher" });
    setModalEditId(null);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (user: CrmUser) => {
    setModalMode("edit");
    setModalForm({ username: user.username, password: "", role: user.role });
    setModalEditId(user.id);
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalEditId(null);
    setError("");
  };

  const handleSubmit = async () => {
    if (!modalForm.username.trim()) { setError("Name is required"); return; }
    if (modalMode === "create" && !modalForm.password.trim()) { setError("Password is required"); return; }

    setModalSaving(true);
    setError("");

    if (modalMode === "create") {
      const res = await fetch("/api/crm/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: modalForm.username.trim(), password: modalForm.password, role: modalForm.role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Failed to create user"); setModalSaving(false); return; }
      if (json.user) setUsers((prev) => [json.user, ...prev]);
      setSuccess("User created successfully");
    } else {
      const payload: Record<string, string> = { username: modalForm.username.trim(), role: modalForm.role };
      if (modalForm.password.trim()) payload.password = modalForm.password;

      const res = await fetch(`/api/crm/users/${modalEditId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Failed to update user"); setModalSaving(false); return; }
      if (json.user) setUsers((prev) => prev.map((u) => (u.id === modalEditId ? json.user : u)));
      setSuccess("User updated successfully");
    }

    setModalSaving(false);
    closeModal();
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    const res = await fetch(`/api/crm/users/${deleteUser.id}`, { method: "DELETE", credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Failed to delete user");
      setDeleting(false);
      setDeleteUser(null);
      setTimeout(() => setError(""), 3000);
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
    setDeleting(false);
    setDeleteUser(null);
    setSuccess("User deleted");
    setTimeout(() => setSuccess(""), 3000);
  };

  const mf = (k: string, v: string) => setModalForm((f) => ({ ...f, [k]: v }));

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20";
  const inputStyle = { background: "var(--c-bg)", border: "1px solid var(--c-border)" };

  return (
    <div>
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-[10px] text-[13.5px] font-semibold mb-5 animate-[fadeUp_0.3s_ease]">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-[15px] shrink-0">✓</div>
          {success}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="text-sm text-[var(--c-text-muted)]">
          {users.length} user{users.length !== 1 ? "s" : ""} registered
        </div>
        <Btn variant="primary" onClick={openCreate}>
          {Icons.plus} Add User
        </Btn>
      </div>

      {/* ─── Create / Edit Modal ─── */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/50" onClick={closeModal} />
          <div
            className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[90vw] rounded-2xl shadow-2xl border border-[var(--c-border)] p-6"
            style={{ background: "var(--c-surface)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-extrabold text-[var(--c-text)] tracking-tight">
                {modalMode === "create" ? "Add User" : "Edit User"}
              </h3>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors hover:bg-[var(--c-bg)]"
                style={{ background: "transparent", color: "var(--c-text-muted)" }}
              >
                {Icons.x}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[9px] mb-4 text-[12.5px] font-medium bg-red-50 border border-red-200 text-red-700">
                {Icons.errorCircle} {error}
              </div>
            )}

            <div className="flex flex-col gap-4 mb-5">
              <div>
                <label className="text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider block mb-1.5">Name *</label>
                <input
                  value={modalForm.username}
                  onChange={(e) => mf("username", e.target.value)}
                  placeholder="e.g. John Smith"
                  className={inputClass}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider block mb-1.5">
                  {modalMode === "create" ? "Password *" : "Password (leave blank to keep)"}
                </label>
                <input
                  value={modalForm.password}
                  onChange={(e) => mf("password", e.target.value)}
                  placeholder={modalMode === "create" ? "Enter password" : "Leave blank to keep current"}
                  type="password"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider block mb-1.5">Role *</label>
                <select
                  value={modalForm.role}
                  onChange={(e) => setModalForm((f) => ({ ...f, role: e.target.value }))}
                  className={`${inputClass} cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={modalSaving}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer border-none transition-colors flex items-center justify-center gap-2"
                style={{ background: "#0170B9", color: "#fff", opacity: modalSaving ? 0.5 : 1 }}
              >
                {modalSaving && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                    <path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {modalSaving
                  ? (modalMode === "create" ? "Creating..." : "Saving...")
                  : (modalMode === "create" ? "Create User" : "Save Changes")}
              </button>
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors"
                style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Delete Confirm Modal ─── */}
      {deleteUser && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/50" onClick={() => setDeleteUser(null)} />
          <div
            className="fixed z-[301] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] max-w-[90vw] rounded-2xl shadow-2xl border border-[var(--c-border)] p-6"
            style={{ background: "var(--c-surface)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.1)" }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-[var(--c-text)] tracking-tight">Delete User</h3>
                <p className="text-[12.5px] text-[var(--c-text-muted)] mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[13px] text-[var(--c-text-secondary)] mb-5">
              Are you sure you want to delete <strong className="text-[var(--c-text)]">{deleteUser.username}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {deleting && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
                {deleting ? "Deleting..." : "Delete User"}
              </button>
              <button
                onClick={() => setDeleteUser(null)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", color: "var(--c-text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Users List ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--c-text-muted)] text-sm">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--c-bg-subtle)] flex items-center justify-center mb-3 text-[var(--c-text-muted)]">{Icons.users}</div>
          <div className="text-sm font-semibold text-[var(--c-text)] mb-1">No users yet</div>
          <div className="text-[12.5px] text-[var(--c-text-muted)]">Add your first user to get started</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] overflow-hidden">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="p-[10px_14px] text-left font-bold text-[10.5px] uppercase tracking-[0.07em] text-[var(--c-text-muted)] border-b border-[var(--c-border)] bg-[var(--c-bg-subtle)]">Name</th>
                  <th className="p-[10px_14px] text-left font-bold text-[10.5px] uppercase tracking-[0.07em] text-[var(--c-text-muted)] border-b border-[var(--c-border)] bg-[var(--c-bg-subtle)]">Role</th>
                  <th className="p-[10px_14px] text-left font-bold text-[10.5px] uppercase tracking-[0.07em] text-[var(--c-text-muted)] border-b border-[var(--c-border)] bg-[var(--c-bg-subtle)]">Created</th>
                  <th className="p-[10px_14px] text-center font-bold text-[10.5px] uppercase tracking-[0.07em] text-[var(--c-text-muted)] border-b border-[var(--c-border)] bg-[var(--c-bg-subtle)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const meta = ROLE_META[u.role] || ROLE_META.teacher;
                  return (
                    <tr key={u.id} className="border-b border-[var(--c-border-light)]">
                      <td className="p-[9px_14px] font-semibold text-[var(--c-text)]">{u.username}</td>
                      <td className="p-[9px_14px]">
                        <span
                          className="inline-flex items-center text-[11px] font-semibold px-2 py-[2px] rounded-[5px]"
                          style={{ color: meta.color, background: meta.bg }}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-[9px_14px] text-[var(--c-text-muted)] text-xs">
                        {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="p-[9px_14px]">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={() => openEdit(u)}
                            className="px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors hover:opacity-80"
                            style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors hover:opacity-80"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-2">
            {users.map((u) => {
              const meta = ROLE_META[u.role] || ROLE_META.teacher;
              return (
                <div key={u.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-[var(--c-text)] text-[13px]">{u.username}</div>
                    <span
                      className="inline-flex items-center text-[11px] font-semibold px-2 py-[2px] rounded-[5px]"
                      style={{ color: meta.color, background: meta.bg }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--c-text-muted)]">
                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer"
                        style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteUser(u)}
                        className="px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
