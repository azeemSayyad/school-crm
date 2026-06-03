"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icons } from "@/components/Icons";
import NotificationDropdown from "@/components/NotificationDropdown";
import LoginScreen from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-context";

const allNavItems = [
  { href: "/crm/users", label: "Users", icon: Icons.users, superAdminOnly: true },
  { href: "/crm/students", label: "Students", icon: Icons.users },
  { href: "/crm/fees", label: "Fee Tracking", icon: Icons.fees, hideForTeacher: true },
  { href: "/crm/teachers", label: "Teachers", icon: Icons.teacher, adminOnly: true },
  { href: "/crm/inbox", label: "Inbox", icon: Icons.inbox },
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
      router.push("/crm/inbox");
    } else if (pathname.startsWith("/crm/fees") && isTeacher) {
      router.push("/crm/inbox");
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

  const brandHref = isTeacher ? "/crm/inbox" : "/crm/students";

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
        <div className="sidebar-brand" onClick={() => router.push(brandHref)}>
          <div className="sidebar-logo">
            {Icons.school}
          </div>
          {!sidebarCollapsed && (
            <span className="sidebar-brand-text">GMTTI</span>
          )}
        </div>

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
                title={sidebarCollapsed ? item.label : undefined}
                className={`sidebar-nav-item${active ? " active" : ""}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                {active && !sidebarCollapsed && <span className="nav-active-bar" />}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle — desktop only */}
        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="16" height="16" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth="2"
            style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!sidebarCollapsed && <span style={{ fontSize: 12, fontWeight: 500 }}>Collapse</span>}
        </button>
      </aside>

      {/* ─── MAIN AREA ─── */}
      <div className="crm-main">
        {/* Top bar */}
        <header className="crm-topbar">
          {/* Hamburger (mobile) / collapse toggle feedback */}
          <button
            className="topbar-hamburger"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            aria-label="Toggle menu"
          >
            {mobileSidebarOpen ? Icons.x : Icons.menu}
          </button>

          {/* Page title derived from path */}
          <div className="topbar-title">
            {filteredNavItems.find(n => pathname.startsWith(n.href))?.label ?? "CRM"}
          </div>

          {/* Right actions */}
          <div className="topbar-right">
            <NotificationDropdown onUnreadCountChange={() => {}} userId={userId ? Number(userId) : null} />

            <div className="topbar-divider" />

            <div className="topbar-user">
              <div className="topbar-avatar">{userInitial}</div>
              <div className="topbar-user-info">
                <span className="topbar-user-email">{user?.username ?? "User"}</span>
                <span className="topbar-user-role">{roleLabel}</span>
              </div>
            </div>

            <div className="topbar-divider" />

            <button 
              className="topbar-logout-btn" 
              onClick={() => {
                setChangePasswordError("");
                setChangePasswordSuccess("");
                setNewPassword("");
                setConfirmPassword("");
                setChangePasswordOpen(true);
              }} 
              title="Change password"
              style={{ marginRight: "12px" }}
            >
              {Icons.lock}
              <span className="topbar-logout-label">Change Password</span>
            </button>

            <button className="topbar-logout-btn" onClick={handleLogout} title="Sign out">
              {Icons.logout}
              <span className="topbar-logout-label">Sign Out</span>
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
