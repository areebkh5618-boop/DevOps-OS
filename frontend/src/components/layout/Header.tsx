"use client";

import { Bell, Search, Command } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-foreground-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary border border-border text-foreground-subtle text-sm w-64">
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1">Search...</span>
          <kbd className="flex items-center gap-0.5 text-[10px] bg-background-elevated px-1.5 py-0.5 rounded border border-border">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-white/5 text-foreground-muted hover:text-foreground transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-rose rounded-full" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
            {(user?.username || "U")[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
