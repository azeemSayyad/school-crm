"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icons } from "@/components/Icons";
import NotificationDropdown from "@/components/NotificationDropdown";
import LoginScreen from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-context";

const allNavItems = [
  { href: "/crm/dashboard", label: "Dashboard", icon: Icons.dash, hideForTeacher: true },
  { href: "/crm/users", label: "Users", icon: Icons.users, superAdminOnly: true },
  { href: "/crm/students", label: "Students", icon: Icons.users },
  { href: "/crm/teachers", label: "Teachers", icon: Icons.teacher, adminOnly: true },
  { href: "/crm/inbox", label: "Inbox", icon: Icons.inbox },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const loggedIn = !!user;
  const role = user?.role ?? null;
  const userId = user?.id ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [visibleCount, setVisibleCount] = useState(100);
  const pathname = usePathname();
  const router = useRouter();

  // Auth state is fully owned by the AuthProvider in src/app/layout.tsx —
  // this component just consumes it via useAuth(). No localStorage involved.

  const handleLogin = () => {
    // After a successful login the LoginScreen calls AuthContext.refresh(),
    // which populates `user` here on the next render. Nothing extra to do.
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  // Progressive collapse measurement
  useEffect(() => {
    const header = headerRef.current;
    const brand = brandRef.current;
    const right = rightRef.current;
    const measure = measureRef.current;
    if (!header || !measure) return;

    const calculate = () => {
      const items = Array.from(measure.children) as HTMLElement[];
      const widths = items.map(el => el.offsetWidth + 16);
      if (!widths.length || !brand || !right) return;

      const headerW = header.offsetWidth;
      const brandW = brand.offsetWidth;
      const rightW = right.offsetWidth;
      const hamburgerW = 48;
      const available = headerW - brandW - rightW - hamburgerW - 32;

      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        if (used + widths[i] <= available) {
          used += widths[i];
          count++;
        } else break;
      }
      setVisibleCount(count >= widths.length ? widths.length : count);

      // Failsafe: if nav is still overflowing after render, reduce by 1
      requestAnimationFrame(() => {
        const nav = navRef.current;
        if (nav && nav.scrollWidth > nav.clientWidth + 2) {
          setVisibleCount(prev => Math.max(prev - 1, 0));
        }
      });
    };

    const ro = new ResizeObserver(calculate);
    ro.observe(header);
    requestAnimationFrame(calculate);
    return () => ro.disconnect();
  }, [loggedIn, role]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#f5f5f5" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="#e5e5e5" strokeWidth="3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="#0170B9" strokeWidth="3" strokeLinecap="round" /></svg>
      </div>
    );
  }
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  const isSuperAdmin = role === "super_admin";
  const isTeacher = role === "teacher";
  const roleLabel = isTeacher ? "Teacher" : role === "admin" ? "Admin" : "Super Admin";

  // Redirect teachers away from restricted pages
  if (isTeacher && pathname === "/crm/dashboard") {
    router.push("/crm/inbox");
    return null;
  }
  // Hard-block /crm/users for anyone who isn't super_admin (page-level guard
  // exists too — this is defense in depth so a non-super_admin can't even
  // briefly see the layout chrome around it).
  if (pathname.startsWith("/crm/users") && !isSuperAdmin) {
    router.push("/crm/dashboard");
    return null;
  }
  if (pathname.startsWith("/crm/teachers") && isTeacher) {
    router.push("/crm/inbox");
    return null;
  }

  const brandHref = isTeacher ? "/crm/appointments" : "/crm/dashboard";

  const filteredNavItems = allNavItems.filter(item => {
    if ("superAdminOnly" in item && item.superAdminOnly && !isSuperAdmin) return false;
    if ("adminOnly" in item && item.adminOnly && isTeacher) return false;
    if ("hideForTeacher" in item && item.hideForTeacher && isTeacher) return false;
    return true;
  });
  const visibleNav = filteredNavItems.slice(0, visibleCount);
  const overflowNav = filteredNavItems.slice(visibleCount);
  const hasOverflow = overflowNav.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--c-bg)]">
      {/* TOP HEADER */}
      <header ref={headerRef} className="flex items-center h-16 shrink-0 px-4 md:px-7 relative" style={{ background: "#0170B9" }}>
        {/* Hidden measurement container */}
        <div
          ref={measureRef}
          aria-hidden
          className="flex gap-0.5 items-center absolute top-0 left-0 h-16 pointer-events-none"
          style={{ visibility: "hidden", whiteSpace: "nowrap" }}
        >
          {filteredNavItems.map(item => (
            <div key={`m-${item.href}`} className="flex items-center gap-2 px-4 md:px-5 py-[7px] text-[13px] font-[inherit]" style={{ fontWeight: 500 }}>
              <span className="flex">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        {/* Brand */}
        <div
          ref={brandRef}
          className="flex items-center gap-3 mr-4 md:mr-14 cursor-pointer shrink-0"
          onClick={() => router.push(brandHref)}
        >
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/20 flex items-center justify-center text-white">
            {Icons.school}
          </div>
          <span className="text-xl md:text-2xl font-bold tracking-tight text-white uppercase italic">School</span>
        </div>

        {/* Visible Nav Items — progressive collapse, hidden below 450px */}
        <nav ref={navRef} className="topnav-collapse flex gap-0.5 md:gap-1 h-full items-center overflow-hidden min-w-0">
          {visibleNav.map((item) => {
            const isRoute = item.href.startsWith("/crm");
            const active = isRoute && (pathname === item.href || pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`topnav-btn${active ? " active" : ""} flex items-center gap-2 px-4 md:px-5 py-[7px] border-none rounded-lg text-[13px] tracking-[0.03em] cursor-pointer font-[inherit] whitespace-nowrap shrink-0 no-underline`}
                style={{
                  fontWeight: active ? 600 : 500,
                  background: active ? "#fff" : "transparent",
                  color: active ? "#0170B9" : "rgba(255,255,255,0.7)",
                  borderRadius: 8,
                }}
              >
                <span className="flex" style={{ opacity: active ? 1 : 0.5 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div ref={rightRef} className="ml-auto flex items-center gap-1.5 md:gap-3 shrink-0">
          <NotificationDropdown onUnreadCountChange={() => {}} userId={userId ? Number(userId) : null} />
          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-white/50">{roleLabel}</span>
          </div>
          <div className="hidden sm:block w-px h-5 bg-white/15" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-[5px] px-2.5 md:px-3 py-[5px] rounded-[6px] text-xs font-semibold cursor-pointer font-[inherit] transition-all hover:bg-white/20"
            style={{ background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            {Icons.logout}
            <span className="hidden sm:inline">Sign Out</span>
          </button>
          {/* Hamburger — visible below 450px always, or when items overflow */}
          {hasOverflow ? (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center justify-center w-9 h-9 rounded-lg border-none cursor-pointer transition-colors"
              style={{
                background: sidebarOpen ? "rgba(255,255,255,0.2)" : "transparent",
                color: sidebarOpen ? "#fff" : "rgba(255,255,255,0.6)",
              }}
            >
              {sidebarOpen ? Icons.x : Icons.menu}
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="topnav-hamburger-mobile items-center justify-center w-9 h-9 rounded-lg border-none cursor-pointer transition-colors"
              style={{
                background: sidebarOpen ? "rgba(255,255,255,0.2)" : "transparent",
                color: sidebarOpen ? "#fff" : "rgba(255,255,255,0.6)",
              }}
            >
              {sidebarOpen ? Icons.x : Icons.menu}
            </button>
          )}
        </div>
      </header>

      {/* Dropdown menu */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setSidebarOpen(false)} />
          <div
            className="fixed right-4 top-[68px] z-[999] w-60 rounded-xl shadow-xl py-2 animate-[fadeUp_0.15s_ease]"
            style={{ background: "#fff", border: "1px solid #e5e5e5" }}
          >
            {filteredNavItems.map(item => {
              const isRoute = item.href.startsWith("/crm");
              const active = isRoute && (pathname === item.href || pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 border-none cursor-pointer font-[inherit] text-left text-[13px] transition-colors no-underline"
                  style={{
                    color: active ? "#0170B9" : "#666",
                    background: active ? "#f0f7fc" : "transparent",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span className="flex shrink-0" style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
