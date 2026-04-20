"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginScreen from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-context";

function landingFor(role: string): string {
  if (role === "teacher") return "/crm/appointments";
  return "/crm/dashboard";
}

export default function RootLanding() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace(landingFor(user.role));
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#f5f5f5" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="animate-spin">
          <circle cx="12" cy="12" r="10" stroke="#e5e5e5" strokeWidth="3" />
          <path d="M12 2a10 10 0 019.75 7.75" stroke="#0170B9" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <LoginScreen
      onLogin={(role) => {
        router.replace(landingFor(role));
      }}
    />
  );
}
