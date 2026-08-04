"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, GitCommit, Star, GitFork, CheckCircle2, XCircle,
  Clock, ExternalLink, Github, Unplug, Loader2, X, GitPullRequest,
  Tag, Eye, Code2
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { githubApi, api } from "@/lib/api";
import { timeAgo, cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Repo = {
  id: number; name: string; full_name: string; description?: string;
  stargazers_count: number; forks_count: number; language?: string;
  private: boolean; updated_at: string; html_url: string;
  default_branch?: string; open_issues_count?: number; watchers_count?: number;
  created_at?: string; topics?: string[];
};

export default function GitHubPage() {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [detailTab, setDetailTab] = useState<"commits" | "runs" | "branches" | "releases">("commits");

  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("connected") === "1") {
      toast.success("GitHub connected successfully");
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
      queryClient.invalidateQueries({ queryKey: ["github-repos"] });
    }
    if (searchParams.get("error")) {
      toast.error(`GitHub error: ${searchParams.get("error")}`);
    }
  }, [queryClient]);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["github-status"],
    queryFn: async () => (await api.get("/auth/github/status")).data,
    staleTime: 60_000,
  });

  const connected = status?.connected;
  const oauthConfigured = status?.oauth_configured;

  const { data: repos = [], isLoading: reposLoading } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => (await githubApi.repos()).data,
    enabled: !!connected,
    staleTime: 60_000,
  });

  const owner = selectedRepo?.full_name?.split("/")[0] || "";
  const repoName = selectedRepo?.name || "";

  const { data: commits = [], isLoading: commitsLoading } = useQuery({
    queryKey: ["github-commits", owner, repoName],
    queryFn: async () => (await githubApi.commits(owner, repoName)).data,
    enabled: !!selectedRepo && detailTab === "commits",
    staleTime: 30_000,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["github-runs", owner, repoName],
    queryFn: async () => (await githubApi.runs(owner, repoName)).data,
    enabled: !!selectedRepo && detailTab === "runs",
    staleTime: 30_000,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["github-branches", owner, repoName],
    queryFn: async () => (await githubApi.branches(owner, repoName)).data,
    enabled: !!selectedRepo && detailTab === "branches",
    staleTime: 60_000,
  });

  const { data: releases = [], isLoading: releasesLoading } = useQuery({
    queryKey: ["github-releases", owner, repoName],
    queryFn: async () => (await githubApi.releases(owner, repoName)).data,
    enabled: !!selectedRepo && detailTab === "releases",
    staleTime: 60_000,
  });

  const handleConnect = () => {
    const token = accessToken || (typeof window !== "undefined" ? localStorage.getItem("access_token") : null);
    if (!token) { toast.error("Please log in first"); return; }
    window.location.href = `${API_URL}/api/v1/auth/github?connect=true&token=${encodeURIComponent(token)}`;
  };

  const handleDisconnect = async () => {
    try {
      await api.delete("/auth/github/disconnect");
      toast.success("GitHub disconnected");
      setSelectedRepo(null);
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
      queryClient.invalidateQueries({ queryKey: ["github-repos"] });
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  return (
    <DashboardLayout>
      <Header title="GitHub" subtitle="Repositories, workflows & commits — in-app details" />
      <div className="p-6 space-y-6">
        {/* Connection banner */}
        <div className="glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? "bg-accent-emerald/15 text-accent-emerald" : "bg-foreground-subtle/15 text-foreground-subtle"}`}>
              <Github className="w-5 h-5" />
            </div>
            <div>
              {statusLoading ? (
                <p className="text-sm text-foreground-muted">Checking connection...</p>
              ) : connected ? (
                <>
                  <p className="text-sm font-medium">Connected as <span className="text-primary">@{status.github_username}</span></p>
                  <p className="text-xs text-foreground-muted">Click any repo to view details here</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">GitHub not connected</p>
                  <p className="text-xs text-foreground-muted">
                    {oauthConfigured ? "Connect to see real repos" : "Set GITHUB_CLIENT_ID/SECRET in backend .env"}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {connected ? (
              <button onClick={handleDisconnect} className="btn-secondary flex items-center gap-2 text-sm">
                <Unplug className="w-3.5 h-3.5" /> Disconnect
              </button>
            ) : (
              <button onClick={handleConnect} disabled={!oauthConfigured} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                <Github className="w-4 h-4" /> Connect GitHub
              </button>
            )}
          </div>
        </div>

        {!connected && (
          <div className="glass-card p-8 text-center">
            <Github className="w-12 h-12 text-foreground-subtle mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect GitHub to get started</h3>
            <p className="text-sm text-foreground-muted max-w-md mx-auto mb-6">
              After connecting, click any repository to see commits, workflows, branches and releases without leaving DevVerse.
            </p>
            {oauthConfigured && (
              <button onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
                <Github className="w-4 h-4" /> Connect with GitHub
              </button>
            )}
          </div>
        )}

        {connected && (
          <div className={cn("grid gap-6", selectedRepo ? "lg:grid-cols-5" : "")}>
            {/* Repo list */}
            <div className={cn(selectedRepo ? "lg:col-span-2" : "")}>
              {reposLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <div className={cn("grid gap-3", selectedRepo ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                  {(repos as Repo[]).map((r) => (
                    <motion.button
                      key={r.id}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setSelectedRepo(r); setDetailTab("commits"); }}
                      className={cn(
                        "glass-card p-4 text-left transition-all hover:border-primary/40 w-full",
                        selectedRepo?.id === r.id && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                            <h3 className="font-medium text-sm truncate">{r.full_name}</h3>
                            {r.private && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber shrink-0">Private</span>}
                          </div>
                          <p className="text-xs text-foreground-muted mt-1 line-clamp-2">{r.description || "No description"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-foreground-muted">
                        {r.language && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />{r.language}</span>}
                        <span className="flex items-center gap-1"><Star className="w-3 h-3" />{r.stargazers_count}</span>
                        <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{r.forks_count}</span>
                        <span className="ml-auto">{timeAgo(r.updated_at)}</span>
                      </div>
                    </motion.button>
                  ))}
                  {repos.length === 0 && (
                    <div className="glass-card p-6 text-center text-foreground-muted text-sm col-span-full">No repositories found.</div>
                  )}
                </div>
              )}
            </div>

            {/* In-app detail panel */}
            <AnimatePresence>
              {selectedRepo && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="lg:col-span-3 glass-card overflow-hidden flex flex-col max-h-[calc(100vh-220px)]"
                >
                  <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold truncate flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-primary shrink-0" />
                        {selectedRepo.full_name}
                      </h2>
                      <p className="text-xs text-foreground-muted mt-1 line-clamp-2">{selectedRepo.description || "No description"}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-foreground-muted">
                        {selectedRepo.language && <span>{selectedRepo.language}</span>}
                        <span className="flex items-center gap-1"><Star className="w-3 h-3" />{selectedRepo.stargazers_count} stars</span>
                        <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{selectedRepo.forks_count} forks</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{selectedRepo.watchers_count ?? 0} watchers</span>
                        {selectedRepo.default_branch && <span>default: {selectedRepo.default_branch}</span>}
                        <span>Updated {timeAgo(selectedRepo.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={selectedRepo.html_url} target="_blank" rel="noopener" className="btn-ghost p-1.5" title="Open on GitHub">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => setSelectedRepo(null)} className="btn-ghost p-1.5" title="Close">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 px-4 pt-3 border-b border-border">
                    {([
                      { id: "commits" as const, label: "Commits", icon: GitCommit },
                      { id: "runs" as const, label: "Actions", icon: GitPullRequest },
                      { id: "branches" as const, label: "Branches", icon: GitBranch },
                      { id: "releases" as const, label: "Releases", icon: Tag },
                    ]).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setDetailTab(t.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                          detailTab === t.id ? "border-primary text-primary" : "border-transparent text-foreground-muted hover:text-foreground"
                        )}
                      >
                        <t.icon className="w-3.5 h-3.5" /> {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {detailTab === "commits" && (
                      <DetailList loading={commitsLoading} empty="No commits">
                        {(commits as any[]).map((c) => (
                          <div key={c.sha} className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-white/5">
                            <GitCommit className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{c.commit?.message?.split("\n")[0]}</p>
                              <p className="text-xs text-foreground-muted mt-0.5">
                                {c.commit?.author?.name} · {c.commit?.author?.date ? timeAgo(c.commit.author.date) : ""}
                              </p>
                            </div>
                            <span className="font-mono text-[10px] text-foreground-subtle shrink-0">{c.sha?.slice(0, 7)}</span>
                          </div>
                        ))}
                      </DetailList>
                    )}

                    {detailTab === "runs" && (
                      <DetailList loading={runsLoading} empty="No workflow runs">
                        {(runs as any[]).map((run) => (
                          <div key={run.id} className="py-2.5 px-2 rounded-lg hover:bg-white/5">
                            <div className="flex items-center gap-3">
                              {run.conclusion === "success" ? <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0" /> :
                               run.conclusion === "failure" ? <XCircle className="w-4 h-4 text-accent-rose shrink-0" /> :
                               <Clock className="w-4 h-4 text-accent-amber shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{run.name} <span className="text-foreground-subtle">#{run.run_number}</span></p>
                                <p className="text-xs text-foreground-muted">
                                  {run.head_branch} · {run.event || "push"} · {run.conclusion || run.status}
                                  {run.conclusion === "failure" && " · failed"}
                                </p>
                              </div>
                              <span className="text-xs text-foreground-muted shrink-0">{timeAgo(run.created_at)}</span>
                            </div>
                            {run.conclusion === "failure" && (
                              <p className="text-xs text-accent-rose mt-1 ml-7">
                                Failed on branch <span className="font-mono">{run.head_branch}</span>
                                {run.html_url && (
                                  <a href={run.html_url} target="_blank" rel="noopener" className="ml-2 text-primary hover:underline">View logs on GitHub</a>
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      </DetailList>
                    )}

                    {detailTab === "branches" && (
                      <DetailList loading={branchesLoading} empty="No branches">
                        {(branches as any[]).map((b: any) => (
                          <div key={b.name} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/5">
                            <GitBranch className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-mono flex-1">{b.name}</span>
                            {b.protected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">protected</span>}
                          </div>
                        ))}
                      </DetailList>
                    )}

                    {detailTab === "releases" && (
                      <DetailList loading={releasesLoading} empty="No releases">
                        {(releases as any[]).map((rel: any) => (
                          <div key={rel.id || rel.tag_name} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/5">
                            <Tag className="w-4 h-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{rel.name || rel.tag_name}</p>
                              <p className="text-xs text-foreground-muted">{rel.tag_name} · {rel.published_at ? timeAgo(rel.published_at) : ""}</p>
                            </div>
                          </div>
                        ))}
                      </DetailList>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailList({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  const items = Array.isArray(children) ? children : [children];
  if (!items.filter(Boolean).length) return <p className="text-xs text-foreground-muted text-center py-8">{empty}</p>;
  return <div className="space-y-0.5">{children}</div>;
}
