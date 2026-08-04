"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Play, Square, RotateCcw, Trash2, Terminal, ScrollText,
  Box, HardDrive, Network, Layers, Plus, RefreshCw, Loader2
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { dockerApi } from "@/lib/api";
import { cn, formatBytes, getStatusColor, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "containers" | "images" | "volumes" | "networks";

export default function DockerPage() {
  const [tab, setTab] = useState<Tab>("containers");
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const queryClient = useQueryClient();

  const { data: containers = [], isLoading, refetch } = useQuery({
    queryKey: ["docker-containers"],
    queryFn: async () => (await dockerApi.containers(true)).data,
    refetchInterval: 20000,
  });

  const { data: images = [] } = useQuery({
    queryKey: ["docker-images"],
    queryFn: async () => (await dockerApi.images()).data,
    enabled: tab === "images",
  });

  const { data: volumes = [] } = useQuery({
    queryKey: ["docker-volumes"],
    queryFn: async () => (await dockerApi.volumes()).data,
    enabled: tab === "volumes",
  });

  const { data: networks = [] } = useQuery({
    queryKey: ["docker-networks"],
    queryFn: async () => (await dockerApi.networks()).data,
    enabled: tab === "networks",
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      if (action === "start") return dockerApi.start(id);
      if (action === "stop") return dockerApi.stop(id);
      if (action === "restart") return dockerApi.restart(id);
      if (action === "remove") return dockerApi.remove(id, true);
    },
    onSuccess: (_, { action }) => {
      toast.success(`Container ${action}ed successfully`);
      queryClient.invalidateQueries({ queryKey: ["docker-containers"] });
    },
    onError: () => toast.error("Action failed"),
  });

  const viewLogs = async (id: string) => {
    setSelectedLogs(id);
    try {
      const { data } = await dockerApi.logs(id, 200);
      setLogs(data.logs || "");
    } catch {
      setLogs("Failed to fetch logs");
    }
  };

  const tabs = [
    { id: "containers" as Tab, label: "Containers", icon: Box, count: containers.length },
    { id: "images" as Tab, label: "Images", icon: Layers, count: images.length },
    { id: "volumes" as Tab, label: "Volumes", icon: HardDrive, count: volumes.length },
    { id: "networks" as Tab, label: "Networks", icon: Network, count: networks.length },
  ];

  const running = containers.filter((c: { state: string }) => c.state === "running").length;
  const stopped = containers.length - running;

  return (
    <DashboardLayout>
      <Header title="Docker" subtitle="Manage containers, images, volumes & networks" />
      
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs text-foreground-muted mb-1">Total Containers</p>
            <p className="text-2xl font-bold">{containers.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-foreground-muted mb-1">Running</p>
            <p className="text-2xl font-bold text-accent-emerald">{running}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-foreground-muted mb-1">Stopped</p>
            <p className="text-2xl font-bold text-foreground-subtle">{stopped}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-foreground-muted mb-1">Images</p>
            <p className="text-2xl font-bold">{images.length || "—"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 p-1 bg-background-secondary rounded-lg border border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
                  tab === t.id ? "bg-primary/15 text-primary" : "text-foreground-muted hover:text-foreground"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                <span className="text-[10px] bg-background-elevated px-1.5 py-0.5 rounded">{t.count}</span>
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Containers Table */}
        {tab === "containers" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-foreground-muted">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Image</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Ports</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td></tr>
                  ) : containers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">No containers found</td></tr>
                  ) : (
                    containers.map((c: {
                      id: string; name: string; image: string; state: string; status: string;
                      ports: Record<string, unknown>; created: string;
                    }) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("status-dot", c.state === "running" ? "status-running" : "status-stopped")} />
                            <span className="font-medium font-mono text-xs">{c.name}</span>
                          </div>
                          <span className="text-[10px] text-foreground-subtle font-mono">{c.id}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground-muted font-mono text-xs">{c.image}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs capitalize", getStatusColor(c.state))}>{c.state}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground-muted font-mono">
                          {c.ports && Object.keys(c.ports).length > 0
                            ? Object.keys(c.ports).join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground-muted">
                          {c.created ? timeAgo(c.created) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {c.state !== "running" ? (
                              <ActionBtn icon={Play} onClick={() => actionMutation.mutate({ id: c.id, action: "start" })} title="Start" />
                            ) : (
                              <ActionBtn icon={Square} onClick={() => actionMutation.mutate({ id: c.id, action: "stop" })} title="Stop" />
                            )}
                            <ActionBtn icon={RotateCcw} onClick={() => actionMutation.mutate({ id: c.id, action: "restart" })} title="Restart" />
                            <ActionBtn icon={ScrollText} onClick={() => viewLogs(c.id)} title="Logs" />
                            <ActionBtn icon={Trash2} onClick={() => actionMutation.mutate({ id: c.id, action: "remove" })} title="Remove" danger />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Images */}
        {tab === "images" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Tags</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {images.map((img: { id: string; tags: string[]; size: number; created: string }) => (
                  <tr key={img.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs">{img.tags?.join(", ") || "<none>"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{img.id}</td>
                    <td className="px-4 py-3 text-xs">{formatBytes(img.size)}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{img.created ? timeAgo(img.created) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Volumes */}
        {tab === "volumes" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Mountpoint</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((v: { name: string; driver: string; mountpoint: string }) => (
                  <tr key={v.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{v.driver}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted truncate max-w-xs">{v.mountpoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Networks */}
        {tab === "networks" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n: { id: string; name: string; driver: string; scope: string }) => (
                  <tr key={n.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{n.name}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{n.driver}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{n.scope}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-subtle">{n.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Logs Modal */}
        {selectedLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLogs(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card w-full max-w-3xl max-h-[70vh] m-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <ScrollText className="w-4 h-4" /> Container Logs — {selectedLogs}
                </h3>
                <button onClick={() => setSelectedLogs(null)} className="btn-ghost text-xs">Close</button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground-muted leading-relaxed whitespace-pre-wrap">
                {logs || "Loading..."}
              </pre>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ActionBtn({ icon: Icon, onClick, title, danger }: {
  icon: React.ElementType; onClick: () => void; title: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        danger ? "hover:bg-accent-rose/15 text-foreground-muted hover:text-accent-rose" : "hover:bg-white/10 text-foreground-muted hover:text-foreground"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
