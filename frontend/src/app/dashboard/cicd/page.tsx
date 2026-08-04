"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, GitPullRequest, BarChart3,
  ChevronDown, ChevronRight, AlertTriangle, GitBranch
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { githubApi } from "@/lib/api";
import { timeAgo, cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const durationData = [
  { name: "Mon", duration: 2.4 },
  { name: "Tue", duration: 3.1 },
  { name: "Wed", duration: 1.8 },
  { name: "Thu", duration: 4.2 },
  { name: "Fri", duration: 2.9 },
  { name: "Sat", duration: 1.5 },
  { name: "Sun", duration: 2.0 },
];

const FALLBACK = [
  {
    id: 1, name: "CI Pipeline", conclusion: "success", run_number: 142,
    head_branch: "main", created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3300000).toISOString(),
    status: "completed", event: "push",
    html_url: "#", head_sha: "a1b2c3d",
  },
  {
    id: 2, name: "Deploy Production", conclusion: "success", run_number: 38,
    head_branch: "main", created_at: new Date(Date.now() - 10800000).toISOString(),
    updated_at: new Date(Date.now() - 10000000).toISOString(),
    status: "completed", event: "workflow_dispatch",
    html_url: "#", head_sha: "e4f5g6h",
  },
  {
    id: 3, name: "CI Pipeline", conclusion: "failure", run_number: 141,
    head_branch: "feature/auth", created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86200000).toISOString(),
    status: "completed", event: "pull_request",
    html_url: "#", head_sha: "f7g8h9i",
    // synthetic failure detail for demo when no real jobs API
    failure_reason: "Unit tests failed in auth module",
    failure_step: "Run tests",
    failure_job: "build-and-test",
  },
  {
    id: 4, name: "Security Scan", conclusion: null, run_number: 12,
    head_branch: "main", created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "in_progress", event: "schedule",
    html_url: "#", head_sha: "j0k1l2m",
  },
];

export default function CICDPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: repos = [] } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      try { return (await githubApi.repos()).data; } catch { return []; }
    },
    staleTime: 120_000,
  });

  const first = repos[0];
  const owner = first?.full_name?.split("/")[0] || "org";
  const repo = first?.name || "devverse";

  const { data: runs = [] } = useQuery({
    queryKey: ["github-runs-cicd", owner, repo],
    queryFn: async () => {
      try { return (await githubApi.runs(owner, repo)).data; } catch { return []; }
    },
    enabled: !!first,
    staleTime: 60_000,
  });

  const list = (runs.length ? runs : FALLBACK) as any[];
  const success = list.filter((r) => r.conclusion === "success").length;
  const failed = list.filter((r) => r.conclusion === "failure").length;
  const running = list.filter((r) => r.status === "in_progress" || r.status === "queued").length;

  // Jobs for expanded failed run
  const expandedRun = list.find((r) => r.id === expanded);
  const { data: jobs = [] } = useQuery({
    queryKey: ["github-jobs", owner, repo, expanded],
    queryFn: async () => {
      if (!expanded || !first) return [];
      try {
        const { data } = await githubApi.runs(owner, repo); // placeholder - use jobs endpoint if available
        return [];
      } catch { return []; }
    },
    enabled: !!expanded && !!first && expandedRun?.conclusion === "failure",
    staleTime: 30_000,
  });

  return (
    <DashboardLayout>
      <Header title="CI/CD" subtitle="Pipeline timeline — when, where & why runs fail" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Runs", value: String(list.length) },
            { label: "Success", value: String(success) },
            { label: "Failed", value: String(failed) },
            { label: "Running", value: String(running) },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4">
              <p className="text-xs text-foreground-muted">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <GitPullRequest className="w-4 h-4" /> Pipeline Timeline
            </h3>
            <div className="space-y-1">
              {list.map((p: any, i: number) => {
                const isOpen = expanded === p.id;
                const isFail = p.conclusion === "failure";
                return (
                  <div key={p.id || i}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-white/5 text-left transition-colors",
                        isOpen && "bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-foreground-subtle shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-foreground-subtle shrink-0" />}
                        {p.conclusion === "success" ? <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0" /> :
                         isFail ? <XCircle className="w-4 h-4 text-accent-rose shrink-0" /> :
                         <Clock className="w-4 h-4 text-accent-amber animate-pulse shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {p.name} <span className="text-foreground-subtle">#{p.run_number}</span>
                          </p>
                          <p className="text-xs text-foreground-muted flex items-center gap-1.5">
                            <GitBranch className="w-3 h-3" /> {p.head_branch}
                            <span>·</span> {p.event || "push"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-foreground-muted shrink-0 ml-2">{timeAgo(p.created_at)}</span>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-3 mb-2 px-4 py-3 rounded-lg bg-background-tertiary border border-border text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-foreground-subtle">When started</p>
                                <p className="font-medium text-foreground">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</p>
                              </div>
                              <div>
                                <p className="text-foreground-subtle">When finished</p>
                                <p className="font-medium text-foreground">
                                  {p.status === "in_progress" ? "Still running" : p.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-foreground-subtle">Where (branch)</p>
                                <p className="font-medium font-mono text-foreground">{p.head_branch}</p>
                              </div>
                              <div>
                                <p className="text-foreground-subtle">Trigger</p>
                                <p className="font-medium text-foreground">{p.event || "push"}</p>
                              </div>
                              <div>
                                <p className="text-foreground-subtle">Status</p>
                                <p className={cn("font-medium capitalize", isFail ? "text-accent-rose" : p.conclusion === "success" ? "text-accent-emerald" : "text-accent-amber")}>
                                  {p.conclusion || p.status}
                                </p>
                              </div>
                              <div>
                                <p className="text-foreground-subtle">Commit</p>
                                <p className="font-mono text-foreground">{(p.head_sha || "").slice(0, 7) || "—"}</p>
                              </div>
                            </div>

                            {isFail && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <p className="flex items-center gap-1.5 text-accent-rose font-medium mb-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Why it failed
                                </p>
                                <p className="text-foreground-muted">
                                  {p.failure_reason || "Workflow concluded with failure. Open the run on GitHub for full job logs."}
                                </p>
                                {p.failure_job && (
                                  <p className="text-foreground-muted mt-1">
                                    Job: <span className="font-mono text-foreground">{p.failure_job}</span>
                                    {p.failure_step && <> · Step: <span className="font-mono text-foreground">{p.failure_step}</span></>}
                                  </p>
                                )}
                                {p.html_url && p.html_url !== "#" && (
                                  <a href={p.html_url} target="_blank" rel="noopener" className="inline-block mt-2 text-primary hover:underline">
                                    View full logs on GitHub →
                                  </a>
                                )}
                              </div>
                            )}

                            {p.status === "in_progress" && (
                              <p className="text-accent-amber flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Pipeline is currently running…
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Avg Build Duration (min)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#6b6b7b" fontSize={10} tickLine={false} />
                <YAxis stroke="#6b6b7b" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1a25", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="duration" fill="#6366f1" radius={[4, 4, 0, 0]} name="Minutes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
