"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ScrollText, Search, Download, RefreshCw, Box, Ship } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { dockerApi, k8sApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Source = "docker" | "k8s";

export default function LogsPage() {
  const [source, setSource] = useState<Source>("docker");
  const [selected, setSelected] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [filter, setFilter] = useState("");
  const [tail, setTail] = useState(200);

  const { data: containers = [] } = useQuery({
    queryKey: ["docker-containers"],
    queryFn: async () => (await dockerApi.containers(true)).data,
    enabled: source === "docker",
  });

  const { data: pods = [] } = useQuery({
    queryKey: ["k8s-pods", namespace],
    queryFn: async () => (await k8sApi.pods(namespace)).data,
    enabled: source === "k8s",
  });

  const { data: logData, isFetching, refetch } = useQuery({
    queryKey: ["logs", source, selected, tail],
    queryFn: async () => {
      if (!selected) return { logs: "" };
      if (source === "docker") {
        const { data } = await dockerApi.logs(selected, tail);
        return data;
      }
      const { data } = await k8sApi.podLogs(selected, namespace, tail);
      return data;
    },
    enabled: !!selected,
  });

  const rawLogs = logData?.logs || "";
  const lines = rawLogs.split("\n").filter((l: string) =>
    !filter || l.toLowerCase().includes(filter.toLowerCase())
  );

  const downloadLogs = () => {
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${selected}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs downloaded");
  };

  return (
    <DashboardLayout>
      <Header title="Logs" subtitle="Docker & Kubernetes log viewer" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 bg-background-secondary rounded-lg border border-border">
            <button onClick={() => { setSource("docker"); setSelected(""); }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm", source === "docker" ? "bg-primary/15 text-primary" : "text-foreground-muted")}>
              <Box className="w-3.5 h-3.5" /> Docker
            </button>
            <button onClick={() => { setSource("k8s"); setSelected(""); }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm", source === "k8s" ? "bg-primary/15 text-primary" : "text-foreground-muted")}>
              <Ship className="w-3.5 h-3.5" /> Kubernetes
            </button>
          </div>

          {source === "docker" ? (
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input-field text-sm py-1.5 w-56">
              <option value="">Select container...</option>
              {containers.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <>
              <input value={namespace} onChange={(e) => setNamespace(e.target.value)} className="input-field text-sm py-1.5 w-32" placeholder="namespace" />
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input-field text-sm py-1.5 w-56">
                <option value="">Select pod...</option>
                {pods.map((p: { name: string }) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </>
          )}

          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-subtle" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field text-sm py-1.5 pl-9 w-full" placeholder="Filter logs..." />
          </div>

          <select value={tail} onChange={(e) => setTail(Number(e.target.value))} className="input-field text-sm py-1.5 w-24">
            {[50, 100, 200, 500, 1000].map((n) => <option key={n} value={n}>{n} lines</option>)}
          </select>

          <button onClick={() => refetch()} className="btn-secondary p-2" title="Refresh"><RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /></button>
          <button onClick={downloadLogs} disabled={!selected} className="btn-secondary p-2 disabled:opacity-40" title="Download"><Download className="w-4 h-4" /></button>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-foreground-muted">
            <ScrollText className="w-3.5 h-3.5" />
            {selected ? `${source === "docker" ? "Container" : "Pod"}: ${selected}` : "Select a source to view logs"}
            <span className="ml-auto">{lines.length} lines</span>
          </div>
          <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[60vh] text-foreground-muted whitespace-pre-wrap">
            {selected ? (lines.length ? lines.join("\n") : "No matching lines") : "—"}
          </pre>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
