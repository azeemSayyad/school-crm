"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Icons } from "@/components/Icons";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (role: string, userId?: number) => void;
}) {
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useState(() => { setTimeout(() => setHasMounted(true), 600); });

  const clearErrors = () => { setUsernameError(""); setPasswordError(""); };

  const handleLogin = async () => {
    clearErrors();
    if (!username.trim()) { setUsernameError("Username is required"); setShake(true); setTimeout(() => setShake(false), 500); return; }
    if (!password) { setPasswordError("Password is required"); setShake(true); setTimeout(() => setShake(false), 500); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // credentials: "same-origin" is the default, so the Set-Cookie response
        // is automatically stored by the browser. No client-side token handling.
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.ok) {
        const data = await res.json();
        // Pull the freshly-set session cookie into AuthContext so all
        // consumers (page.tsx, crm/layout.tsx, inner components) see the new user.
        await refresh();
        onLogin(data.user.role, data.user.id);
        setLoading(false);
        return;
      }
    } catch { /* Fall through */ }

    setUsernameError("Invalid username or password");
    setPasswordError(" ");
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleLogin(); };

  const hasError = (field: string) => field === "username" ? !!usernameError : !!passwordError;
  const borderColor = (field: string) => hasError(field) ? "#ef4444" : focused === field ? "#fff" : "rgba(255,255,255,0.12)";
  const ringStyle = (field: string) => focused === field ? `0 0 0 3px ${hasError(field) ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.1)"}` : "none";

  return (
    <div className="h-screen flex flex-col items-center justify-center overflow-hidden relative px-6 md:px-4"
      style={{ background: "linear-gradient(145deg, #0170B9, #015a94, #024a7a)", fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      {/* Decorative circles */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full" style={{ background: "rgba(255,255,255,0.03)" }} />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full" style={{ background: "rgba(255,255,255,0.02)" }} />

      {/* Card — full width on mobile, card on desktop */}
      <div className={`relative z-[1] w-full max-w-[440px] ${shake ? "animate-[shakeX_0.4s_ease]" : hasMounted ? "" : "animate-[fadeUp_0.5s_ease_both]"}`}>

        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-4 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/20">
            <div className="scale-[2.5] flex">
              {Icons.school}
            </div>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter text-white uppercase italic">School</h2>
        </div>

        {/* Header — clear hierarchy */}
        <div className="text-center mb-8">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white leading-tight">
            Welcome back
          </h1>
          <p className="text-[14px] font-normal mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            Enter your credentials to continue
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6 md:p-8 border border-white/[0.15] backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.07)" }}>

          {/* Username */}
          <div className="mb-5">
            <label className="text-[13px] font-medium block mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Username</label>
            <input
              className="w-full h-[48px] px-4 rounded-xl text-[15px] outline-none transition-all text-white"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1.5px solid ${borderColor("username")}`,
                boxShadow: ringStyle("username"),
              }}
              placeholder="Enter your username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearErrors(); }}
              onFocus={() => setFocused("username")}
              onBlur={() => setFocused(null)}
              onKeyDown={handleKey}
              autoFocus
            />
            {usernameError && usernameError !== " " && (
              <p className="text-[12px] font-medium mt-1.5" style={{ color: "#fca5a5" }}>{usernameError}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-7">
            <label className="text-[13px] font-medium block mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Password</label>
            <div className="relative">
              <input
                className="w-full h-[48px] px-4 pr-12 rounded-xl text-[15px] outline-none transition-all text-white"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${borderColor("password")}`,
                  boxShadow: ringStyle("password"),
                }}
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={handleKey}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-all"
                style={{ background: "transparent", color: "rgba(255,255,255,0.35)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              >
                {showPassword ? (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            {passwordError && passwordError !== " " && (
              <p className="text-[12px] font-medium mt-1.5" style={{ color: "#fca5a5" }}>{passwordError}</p>
            )}
          </div>

          {/* Sign In — prominent, saturated, tappable */}
          <button onClick={handleLogin} disabled={loading}
            className="w-full h-[48px] rounded-xl text-[15px] font-semibold cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            style={{ background: "#fff", color: "#0170B9", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke="rgba(1,112,185,0.2)" strokeWidth="3" /><path d="M12 2a10 10 0 019.75 7.75" stroke="#0170B9" strokeWidth="3" strokeLinecap="round" /></svg>
                Signing in...
              </span>
            ) : "Sign In"}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center mt-10 text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          School Management System
        </p>
      </div>

      {/* Placeholder styles */}
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25) !important; }
      `}</style>
    </div>
  );
}
