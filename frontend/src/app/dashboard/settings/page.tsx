"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Settings, User, Key, Server, Palette, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { authApi, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "profile" | "security" | "apikeys" | "clusters" | "appearance";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const { user, fetchUser } = useAuthStore();
  const [profile, setProfile] = useState({ full_name: user?.full_name || "", username: user?.username || "" });
  const [passwords, setPasswords] = useState({ current: "", next: "" });

  const { data: ghStatus } = useQuery({
    queryKey: ["github-status"],
    queryFn: async () => (await api.get("/auth/github/status")).data,
  });

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "apikeys", label: "API Keys", icon: Key },
    { id: "clusters", label: "Clusters", icon: Server },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  const saveProfile = async () => {
    try {
      await authApi.updateMe(profile);
      await fetchUser();
      toast.success("Profile updated");
    } catch {
      toast.error("Update failed");
    }
  };

  const changePassword = async () => {
    try {
      await authApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "" });
      toast.success("Password changed");
    } catch {
      toast.error("Password change failed");
    }
  };

  return (
    <DashboardLayout>
      <Header title="Settings" subtitle="Profile, security, API keys & clusters" />
      <div className="p-6 flex flex-col md:flex-row gap-6">
        <div className="md:w-48 shrink-0 space-y-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all",
                tab === t.id ? "bg-primary/15 text-primary" : "text-foreground-muted hover:text-foreground hover:bg-white/5")}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 glass-card p-6 space-y-4">
          {tab === "profile" && (
            <>
              <h3 className="text-sm font-medium">Profile</h3>
              <div>
                <label className="text-xs text-foreground-muted mb-1 block">Full name</label>
                <input className="input-field" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-foreground-muted mb-1 block">Username</label>
                <input className="input-field" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-foreground-muted mb-1 block">Email</label>
                <input className="input-field opacity-60" value={user?.email || ""} disabled />
              </div>
              <div>
                <label className="text-xs text-foreground-muted mb-1 block">Role</label>
                <input className="input-field opacity-60 capitalize" value={user?.role || ""} disabled />
              </div>
              <div className="text-xs text-foreground-muted">
                GitHub: {ghStatus?.connected ? `@${ghStatus.github_username}` : "Not connected"}
              </div>
              <button onClick={saveProfile} className="btn-primary text-sm">Save changes</button>
            </>
          )}

          {tab === "security" && (
            <>
              <h3 className="text-sm font-medium">Change password</h3>
              <div>
                <label className="text-xs text-foreground-muted mb-1 block">Current password</label>
                <input type="password" className="input-field" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-foreground-muted mb-1 block">New password</label>
                <input type="password" className="input-field" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
              </div>
              <button onClick={changePassword} className="btn-primary text-sm">Update password</button>
            </>
          )}

          {tab === "apikeys" && (
            <>
              <h3 className="text-sm font-medium">API Keys</h3>
              <p className="text-xs text-foreground-muted">Generate keys for CI/CD and external integrations.</p>
              <div className="border border-border rounded-lg p-4 text-center text-sm text-foreground-muted">
                No API keys yet
              </div>
              <button className="btn-primary text-sm" onClick={() => toast.info("API key generation coming in next release")}>
                Generate new key
              </button>
            </>
          )}

          {tab === "clusters" && (
            <>
              <h3 className="text-sm font-medium">Kubernetes Clusters</h3>
              <p className="text-xs text-foreground-muted">Manage kubeconfig connections.</p>
              <div className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">default</span>
                  <span className="text-xs text-accent-emerald">Active</span>
                </div>
              </div>
              <button className="btn-secondary text-sm" onClick={() => toast.info("Add cluster via KUBECONFIG env")}>
                Add cluster
              </button>
            </>
          )}

          {tab === "appearance" && (
            <>
              <h3 className="text-sm font-medium">Appearance</h3>
              <p className="text-xs text-foreground-muted mb-4">DevVerse uses a dark glassmorphism theme by default.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border-2 border-primary p-4 bg-[#0a0a0f]">
                  <div className="h-8 rounded bg-[#1a1a25] mb-2" />
                  <p className="text-xs text-center">Dark (active)</p>
                </div>
                <div className="rounded-xl border border-border p-4 bg-gray-100 opacity-50 cursor-not-allowed">
                  <div className="h-8 rounded bg-white mb-2" />
                  <p className="text-xs text-center text-gray-600">Light (soon)</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
