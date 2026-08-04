"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Box,
  Ship,
  GitBranch,
  GitPullRequest,
  FileCode,
  Network,
  Activity,
  ScrollText,
  Terminal,
  FileEdit,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/docker", label: "Docker", icon: Box },
  { href: "/dashboard/kubernetes", label: "Kubernetes", icon: Ship },
  { href: "/dashboard/github", label: "GitHub", icon: GitBranch },
  { href: "/dashboard/cicd", label: "CI/CD", icon: GitPullRequest },
  { href: "/dashboard/yaml-builder", label: "YAML Builder", icon: FileCode },
  { href: "/dashboard/network", label: "Network", icon: Network },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
  { href: "/dashboard/terminal", label: "Terminal", icon: Terminal },
  { href: "/dashboard/editor", label: "Editor", icon: FileEdit },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      className="fixed left-0 top-0 h-screen z-40 flex flex-col glass border-r border-border"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 text-primary">
          <Zap className="w-5 h-5" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col"
          >
            <span className="font-semibold text-sm tracking-tight">DevVerse</span>
            <span className="text-[10px] text-foreground-subtle">DevOps OS</span>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-foreground-muted hover:text-foreground hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r"
                  />
                )}
                <Icon className={cn("w-4.5 h-4.5 shrink-0", isActive && "text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-border p-2 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium truncate">{user.full_name || user.username}</p>
            <p className="text-[10px] text-foreground-subtle truncate capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-accent-rose hover:bg-accent-rose/10 transition-all"
        >
          <LogOut className="w-4.5 h-4.5" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-white/5 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
