"use client";

import { motion } from "framer-motion";
import { History, CheckCircle2, XCircle, RotateCcw, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

const HISTORY = [
  { id: 1, name: "api-server", action: "scale", status: "success", from: "2 → 5 replicas", time: "2 hours ago", user: "admin", ns: "default" },
  { id: 2, name: "nginx", action: "restart", status: "success", from: "rolling restart", time: "5 hours ago", user: "operator", ns: "default" },
  { id: 3, name: "worker", action: "deploy", status: "failed", from: "v1.1 → v1.2", time: "1 day ago", user: "admin", ns: "prod", error: "ImagePullBackOff" },
  { id: 4, name: "api-server", action: "deploy", status: "success", from: "v1.1 → v1.2", time: "2 days ago", user: "admin", ns: "default" },
  { id: 5, name: "redis", action: "create", status: "success", from: "new container", time: "3 days ago", user: "operator", ns: "—" },
  { id: 6, name: "api-server", action: "rollback", status: "success", from: "v1.2 → v1.1", time: "4 days ago", user: "admin", ns: "default" },
];

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <Header title="Deployment History" subtitle="Timeline of deploys, scales, restarts & rollbacks" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Events", value: HISTORY.length },
            { label: "Success", value: HISTORY.filter((h) => h.status === "success").length },
            { label: "Failed", value: HISTORY.filter((h) => h.status === "failed").length },
            { label: "Rollbacks", value: HISTORY.filter((h) => h.action === "rollback").length },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4">
              <p className="text-xs text-foreground-muted">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium mb-6 flex items-center gap-2"><History className="w-4 h-4" /> Timeline</h3>
          <div className="relative pl-8 space-y-0">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            {HISTORY.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative pb-6 last:pb-0"
              >
                <div className={cn(
                  "absolute left-[-20px] top-1 w-3 h-3 rounded-full border-2 border-background",
                  h.status === "success" ? "bg-accent-emerald" : "bg-accent-rose"
                )} />
                <div className="flex items-start justify-between gap-4 py-2 px-3 rounded-lg hover:bg-white/5">
                  <div className="flex items-start gap-3">
                    {h.status === "success" ? (
                      h.action === "rollback" ? <RotateCcw className="w-4 h-4 text-accent-amber mt-0.5" /> :
                      <CheckCircle2 className="w-4 h-4 text-accent-emerald mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-accent-rose mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        <span className="capitalize text-primary">{h.action}</span>{" "}
                        <span className="font-mono">{h.name}</span>
                        {h.ns !== "—" && <span className="text-foreground-subtle text-xs ml-2">ns/{h.ns}</span>}
                      </p>
                      <p className="text-xs text-foreground-muted mt-0.5">{h.from}</p>
                      {h.error && <p className="text-xs text-accent-rose mt-0.5">{h.error}</p>}
                      <p className="text-[10px] text-foreground-subtle mt-1">by {h.user}</p>
                    </div>
                  </div>
                  <span className="text-xs text-foreground-muted flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> {h.time}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
