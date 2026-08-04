"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/stores/auth";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchUser, accessToken } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (accessToken && !useAuthStore.getState().user) {
      fetchUser();
    }
  }, [accessToken, isAuthenticated, fetchUser, router]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-[240px] min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
