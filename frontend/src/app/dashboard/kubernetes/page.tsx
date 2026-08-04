"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Ship, Box, Network, FileKey, Settings2, RefreshCw,
  Scale, RotateCcw, Trash2, ScrollText, Loader2
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { k8sApi } from "@/lib/api";
import { cn, getStatusColor, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "pods" | "deployments" | "services" | "ingresses" | "configmaps" | "secrets" | "events";

export default function KubernetesPage() {
  const [tab, setTab] = useState<Tab>("pods");
  const [namespace, setNamespace] = useState("default");
  const [logsModal, setLogsModal] = useState<{ name: string; logs: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: namespaces = [] } = useQuery({
    queryKey: ["k8s-namespaces"],
    queryFn: async () => (await k8sApi.namespaces()).data,
  });

  const { data: pods = [], isLoading: podsLoading, refetch } = useQuery({
    queryKey: ["k8s-pods", namespace],
    queryFn: async () => (await k8sApi.pods(namespace)).data,
    refetchInterval: 20000,
  });

  const { data: deployments = [] } = useQuery({
    queryKey: ["k8s-deployments", namespace],
    queryFn: async () => (await k8sApi.deployments(namespace)).data,
    enabled: tab === "deployments",
  });

  const { data: services = [] } = useQuery({
    queryKey: ["k8s-services", namespace],
    queryFn: async () => (await k8sApi.services(namespace)).data,
    enabled: tab === "services",
  });

  const { data: events = [] } = useQuery({
    queryKey: ["k8s-events", namespace],
    queryFn: async () => (await k8sApi.events(namespace)).data,
    enabled: tab === "events",
  });

  const scaleMutation = useMutation({
    mutationFn: ({ name, replicas }: { name: string; replicas: number }) =>
      k8sApi.scale(name, replicas, namespace),
    onSuccess: () => {
      toast.success("Deployment scaled");
      queryClient.invalidateQueries({ queryKey: ["k8s-deployments"] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: (name: string) => k8sApi.restart(name, namespace),
    onSuccess: () => {
      toast.success("Deployment restart triggered");
      queryClient.invalidateQueries({ queryKey: ["k8s-deployments"] });
    },
  });

  const viewPodLogs = async (name: string) => {
    try {
      const { data } = await k8sApi.podLogs(name, namespace);
      setLogsModal({ name, logs: data.logs || "" });
    } catch {
      setLogsModal({ name, logs: "Failed to fetch logs" });
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "pods", label: "Pods", icon: Box },
    { id: "deployments", label: "Deployments", icon: Ship },
    { id: "services", label: "Services", icon: Network },
    { id: "events", label: "Events", icon: Settings2 },
  ];

  return (
    <DashboardLayout>
      <Header title="Kubernetes" subtitle="Manage cluster resources" />

      <div className="p-6 space-y-6">
        {/* Namespace selector + tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="input-field text-sm py-1.5 w-40"
            >
              {(namespaces.length ? namespaces : [{ name: "default" }, { name: "kube-system" }]).map(
                (ns: { name: string }) => (
                  <option key={ns.name} value={ns.name}>{ns.name}</option>
                )
              )}
            </select>
            <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Pods */}
        {tab === "pods" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Ready</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Restarts</th>
                  <th className="px-4 py-3 font-medium">Node</th>
                  <th className="px-4 py-3 font-medium">Age</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {podsLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                ) : pods.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground-muted">No pods in this namespace</td></tr>
                ) : (
                  pods.map((p: {
                    name: string; ready: string; phase: string; restarts: number;
                    node?: string; created: string;
                  }) => (
                    <tr key={p.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("status-dot", p.phase === "Running" ? "status-running" : p.phase === "Pending" ? "status-pending" : "status-error")} />
                          <span className="font-mono text-xs font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{p.ready}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs", getStatusColor(p.phase))}>{p.phase}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.restarts}</td>
                      <td className="px-4 py-3 text-xs text-foreground-muted">{p.node || "—"}</td>
                      <td className="px-4 py-3 text-xs text-foreground-muted">{p.created ? timeAgo(p.created) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => viewPodLogs(p.name)} className="p-1.5 rounded-md hover:bg-white/10 text-foreground-muted hover:text-foreground" title="Logs">
                            <ScrollText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Deployments */}
        {tab === "deployments" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Ready</th>
                  <th className="px-4 py-3 font-medium">Image</th>
                  <th className="px-4 py-3 font-medium">Strategy</th>
                  <th className="px-4 py-3 font-medium">Age</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d: {
                  name: string; ready_replicas: number; replicas: number;
                  image?: string; strategy: string; created: string;
                }) => (
                  <tr key={d.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      <span className={d.ready_replicas === d.replicas ? "text-accent-emerald" : "text-accent-amber"}>
                        {d.ready_replicas}/{d.replicas}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{d.image || "—"}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{d.strategy}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{d.created ? timeAgo(d.created) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            const r = prompt("New replica count:", String(d.replicas));
                            if (r !== null) scaleMutation.mutate({ name: d.name, replicas: parseInt(r) });
                          }}
                          className="p-1.5 rounded-md hover:bg-white/10 text-foreground-muted hover:text-foreground"
                          title="Scale"
                        >
                          <Scale className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => restartMutation.mutate(d.name)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-foreground-muted hover:text-foreground"
                          title="Restart"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Services */}
        {tab === "services" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Cluster IP</th>
                  <th className="px-4 py-3 font-medium">Ports</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s: {
                  name: string; type: string; cluster_ip?: string;
                  ports: { port: number; target_port: string; protocol: string }[];
                }) => (
                  <tr key={s.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{s.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{s.cluster_ip || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">
                      {(s.ports || []).map((p) => `${p.port}:${p.target_port}/${p.protocol}`).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Events */}
        {tab === "events" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Object</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: {
                  type: string; reason: string; involved_object: string;
                  message: string; count: number;
                }, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", e.type === "Normal" ? "text-accent-emerald" : "text-accent-rose")}>{e.type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{e.reason}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{e.involved_object}</td>
                    <td className="px-4 py-3 text-xs text-foreground-muted max-w-xs truncate">{e.message}</td>
                    <td className="px-4 py-3 text-xs">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Logs Modal */}
        {logsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setLogsModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card w-full max-w-3xl max-h-[70vh] m-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-medium">Pod Logs — {logsModal.name}</h3>
                <button onClick={() => setLogsModal(null)} className="btn-ghost text-xs">Close</button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground-muted leading-relaxed whitespace-pre-wrap">
                {logsModal.logs}
              </pre>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
