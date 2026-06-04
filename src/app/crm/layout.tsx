"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icons } from "@/components/Icons";
import NotificationDropdown from "@/components/NotificationDropdown";
import LoginScreen from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-context";

const allNavItems = [
  { href: "/crm/students", label: "Students", icon: Icons.users },
  { href: "/crm/fees", label: "Fee Tracking", icon: Icons.fees, hideForTeacher: true },
  { href: "/crm/teachers", label: "Teachers", icon: Icons.teacher, adminOnly: true },
  { href: "/crm/users", label: "Users", icon: Icons.users, superAdminOnly: true },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const loggedIn = !!user;
  const role = user?.role ?? null;
  const userId = user?.id ?? null;
  // On desktop default to expanded; on mobile default to collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Change Password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setChangePasswordError("Password cannot be empty");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    setChangePasswordError("");
    setChangePasswordSuccess("");

    try {
      const res = await fetch(`/api/crm/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChangePasswordError(data.error || "Failed to change password");
      } else {
        setChangePasswordSuccess("Password changed successfully");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setChangePasswordOpen(false);
          setChangePasswordSuccess("");
        }, 2000);
      }
    } catch (err) {
      setChangePasswordError("Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Close mobile sidebar on wide viewports
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileSidebarOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const isSuperAdmin = role === "super_admin";
  const isTeacher = role === "teacher";
  const roleLabel = isTeacher ? "Teacher" : role === "admin" ? "Admin" : "Super Admin";

  // Determine authorization status
  const isAuthorized = (() => {
    if (pathname.startsWith("/crm/users") && !isSuperAdmin) return false;
    if (pathname.startsWith("/crm/teachers") && isTeacher) return false;
    if (pathname.startsWith("/crm/fees") && isTeacher) return false;
    return true;
  })();

  // Route guards executed inside useEffect to prevent updating Router during render
  useEffect(() => {
    if (authLoading || !loggedIn) return;
    if (pathname.startsWith("/crm/users") && !isSuperAdmin) {
      router.push("/crm/students");
    } else if (pathname.startsWith("/crm/teachers") && isTeacher) {
      router.push("/crm/students");
    } else if (pathname.startsWith("/crm/fees") && isTeacher) {
      router.push("/crm/students");
    }
  }, [authLoading, loggedIn, pathname, isSuperAdmin, isTeacher, router]);

  if (authLoading || (loggedIn && !isAuthorized)) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#f5f7fa" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="animate-spin">
          <circle cx="12" cy="12" r="10" stroke="#e5e5e5" strokeWidth="3" />
          <path d="M12 2a10 10 0 019.75 7.75" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (!loggedIn) return <LoginScreen onLogin={() => {}} />;

  const brandHref = "/crm/students";

  const filteredNavItems = allNavItems.filter(item => {
    if ("superAdminOnly" in item && item.superAdminOnly && !isSuperAdmin) return false;
    if ("adminOnly" in item && item.adminOnly && isTeacher) return false;
    if ("hideForTeacher" in item && item.hideForTeacher && isTeacher) return false;
    return true;
  });

  const userInitial = (user?.username?.[0] || "U").toUpperCase();

  return (
    <div className="crm-shell">
      {/* ─── MOBILE OVERLAY ─── */}
      {mobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ─── LEFT SIDEBAR ─── */}
      <aside
        className={`crm-sidebar${sidebarCollapsed ? " collapsed" : ""}${mobileSidebarOpen ? " mobile-open" : ""}`}
      >
        {/* Sidebar header / brand */}
        {!sidebarCollapsed ? (
          <div className="sidebar-brand flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push(brandHref)}>
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-[#0170B9] shrink-0 shadow-sm">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                </svg>
              </div>
              <span className="sidebar-brand-text font-black text-[15px] tracking-wider text-slate-800">MVHS</span>
            </div>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100/70 border border-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="sidebar-brand flex items-center justify-center py-4 border-b border-gray-100">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 hover:bg-blue-100/70 border border-blue-100/60 text-[#0170B9] transition-all cursor-pointer shadow-sm"
              title="Expand sidebar"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}



        {/* Group Header: Navigation */}
        {!sidebarCollapsed && (
          <div className="px-4 text-[9.5px] font-extrabold tracking-wider text-slate-400 uppercase mt-2 mb-1.5">Navigation</div>
        )}

        {/* Nav items */}
        <nav className="sidebar-nav">
          {filteredNavItems.map((item) => {
            const isRoute = item.href.startsWith("/crm");
            const active = isRoute && (pathname === item.href || pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`group relative sidebar-nav-item${active ? " active" : ""}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                {sidebarCollapsed && (
                  <span className="pointer-events-none absolute left-full ml-4 z-50 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-slate-900">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Group Header: Account */}
        {!sidebarCollapsed ? (
          <div className="px-4 text-[9.5px] font-extrabold tracking-wider text-slate-400 uppercase mt-4 mb-1.5">Account</div>
        ) : (
          <div className="border-t border-slate-100 my-3 mx-2" />
        )}

        {/* Sidebar Footer */}
        <div className="sidebar-footer p-2 flex flex-col gap-0.5">
          <button
            onClick={() => {
              setChangePasswordError("");
              setChangePasswordSuccess("");
              setNewPassword("");
              setConfirmPassword("");
              setChangePasswordOpen(true);
            }}
            className="group relative sidebar-nav-item w-full text-left cursor-pointer"
            style={{ background: "transparent", border: "none" }}
          >
            <span className="nav-icon text-[#0170B9]">{Icons.lock}</span>
            {!sidebarCollapsed && <span className="nav-label">Change Password</span>}
            {sidebarCollapsed && (
              <span className="pointer-events-none absolute left-full ml-4 z-50 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-slate-900">
                Change Password
              </span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="group relative sidebar-nav-item w-full text-left cursor-pointer text-rose-600 hover:bg-rose-50/70 hover:text-rose-700"
            style={{ background: "transparent", border: "none" }}
          >
            <span className="nav-icon text-rose-500">{Icons.logout}</span>
            {!sidebarCollapsed && <span className="nav-label">Sign Out</span>}
            {sidebarCollapsed && (
              <span className="pointer-events-none absolute left-full ml-4 z-50 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-slate-900">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ─── MAIN AREA ─── */}
      <div className="crm-main">
        {/* Top bar */}
        <header className="crm-topbar">
          {/* Mobile-only logo and brand on the left */}
          <div className="md:hidden flex items-center gap-2 cursor-pointer" onClick={() => router.push(brandHref)}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-[#0170B9] shrink-0 shadow-sm">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
            <span className="font-black text-[14px] text-slate-800 tracking-wider">MVHS</span>
          </div>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="topbar-right">
            <NotificationDropdown onUnreadCountChange={() => {}} userId={userId ? Number(userId) : null} />

            {/* Desktop-only user info */}
            <div className="hidden md:flex items-center gap-3">
              <div className="topbar-divider" />
              <div className="topbar-user">
                <div className="topbar-avatar">{userInitial}</div>
                <div className="topbar-user-info">
                  <span className="topbar-user-email">{user?.username ?? "User"}</span>
                  <span className="topbar-user-role">{roleLabel}</span>
                </div>
              </div>
            </div>

            {/* Hamburger (mobile) brought to the right-most position */}
            <button
              className="topbar-hamburger md:hidden ml-2"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle menu"
            >
              {mobileSidebarOpen ? Icons.x : Icons.menu}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="crm-content">
          {children}
        </main>
      </div>

      {/* ─── CHANGE PASSWORD MODAL ─── */}
      {changePasswordOpen && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/50" onClick={() => setChangePasswordOpen(false)} />
          <div
            className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] max-w-[90vw] rounded-2xl shadow-2xl p-6 bg-white border border-gray-100"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                {Icons.lock} Change Password
              </h3>
              <button
                onClick={() => setChangePasswordOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors hover:bg-gray-100"
                style={{ background: "transparent", color: "#9ca3af" }}
              >
                {Icons.x}
              </button>
            </div>

            {changePasswordError && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[9px] mb-4 text-[12.5px] font-medium bg-red-50 border border-red-200 text-red-700">
                {Icons.errorCircle} {changePasswordError}
              </div>
            )}

            {changePasswordSuccess && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[9px] mb-4 text-[12.5px] font-medium bg-green-50 border border-green-200 text-green-700">
                <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[12px] font-bold shrink-0">✓</span> {changePasswordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 mb-5">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2.5 rounded-lg text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#0170B9]/20 bg-gray-50 border border-gray-200"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3.5 py-2.5 rounded-lg text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#0170B9]/20 bg-gray-50 border border-gray-200"
                  required
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer border-none transition-colors flex items-center justify-center gap-2"
                  style={{ background: "#0170B9", color: "#fff", opacity: changingPassword ? 0.5 : 1 }}
                >
                  {changingPassword ? "Updating..." : "Update Password"}
                </button>
                <button
                  type="button"
                  onClick={() => setChangePasswordOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
