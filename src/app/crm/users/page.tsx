"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UsersManagement from "@/components/UsersManagement";
import { useAuth } from "@/lib/auth-context";

export default function UsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "super_admin") {
      router.replace("/crm/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;
  if (user.role !== "super_admin") return null;

  return (
    <>
      <div className="px-4 md:px-7 py-3 md:py-3.5 border-b border-[var(--c-border)] bg-[var(--c-surface)] shrink-0">
        <h1 className="text-base md:text-[19px] font-extrabold text-[var(--c-text)] tracking-tight leading-tight">User Management</h1>
        <p className="text-[11.5px] md:text-[12.5px] text-[var(--c-text-muted)] mt-0.5 font-[450]">Manage CRM users and permissions</p>
      </div>
      <div className="p-3 md:p-[20px_28px]">
        <UsersManagement />
      </div>
    </>
  );
}
