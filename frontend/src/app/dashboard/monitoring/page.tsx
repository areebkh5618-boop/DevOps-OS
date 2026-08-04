"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, HardDrive, Network, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { dashboardApi } from "@/lib/api";
import { formatBytes, formatPercent } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";

export default function MonitoringPage() {
  const [history, setHistory] = useState<{ time: string; cpu: number; mem: number; disk: number }[]>([]);

  const { data: metrics } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => (await dashboardApi.metrics()).data,
    refetchInterval: 3000,
  });

  const { data: overview } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => (await dashboardApi.overview()).data,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!metrics) return;
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setHistory((prev) => [
      ...prev.slice(-29),
      {
        time: t,
        cpu: metrics.cpu?.overall ?? 0,
        mem: metrics.memory?.percent ?? 0,
        disk: metrics.disk?.percent ?? 0,
      },
    ]);
  }, [metrics]);

  const cpu = metrics?.cpu?.overall ?? overview?.system?.cpu_percent ?? 0;
  const mem = metrics?.memory?.percent ?? overview?.system?.memory?.percent ?? 0;
  const disk = metrics?.disk?.percent ?? overview?.system?.disk?.percent ?? 0;
  const perCpu = metrics?.cpu?.per_cpu ?? [];

  return (
    <DashboardLayout>
      <Header title="Monitoring" subtitle="Live system & container metrics" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="CPU" value={formatPercent(cpu)} icon={Cpu} color="text-accent-cyan" pct={cpu} />
          <MetricCard title="Memory" value={formatPercent(mem)} sub={formatBytes(metrics?.memory?.used ?? 0)} icon={MemoryStick} color="text-accent-violet" pct={mem} />
          <MetricCard title="Disk" value={formatPercent(disk)} sub={formatBytes(metrics?.disk?.used ?? 0)} icon={HardDrive} color="text-accent-amber" pct={disk} />
          <MetricCard title="Network RX" value={formatBytes(metrics?.network?.bytes_recv ?? 0)} icon={Network} color="text-accent-emerald" pct={0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> CPU & Memory (live)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#6b6b7b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b7b" fontSize={10} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#1a1a25", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="cpu" stroke="#6366f1" fill="url(#c)" strokeWidth={2} name="CPU" />
                <Area type="monotone" dataKey="mem" stroke="#22d3ee" fill="url(#m)" strokeWidth={2} name="Memory" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="text-sm font-medium mb-4">Per-CPU Cores</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={perCpu.map((v: number, i: number) => ({ core: `C${i}`, value: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="core" stroke="#6b6b7b" fontSize={10} tickLine={false} />
                <YAxis stroke="#6b6b7b" fontSize={10} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#1a1a25", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Usage %" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium mb-4">Network I/O</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-foreground-muted text-xs">Bytes Sent</p><p className="font-mono font-medium">{formatBytes(metrics?.network?.bytes_sent ?? 0)}</p></div>
            <div><p className="text-foreground-muted text-xs">Bytes Received</p><p className="font-mono font-medium">{formatBytes(metrics?.network?.bytes_recv ?? 0)}</p></div>
            <div><p className="text-foreground-muted text-xs">Packets Sent</p><p className="font-mono font-medium">{(metrics?.network?.packets_sent ?? 0).toLocaleString()}</p></div>
            <div><p className="text-foreground-muted text-xs">Packets Received</p><p className="font-mono font-medium">{(metrics?.network?.packets_recv ?? 0).toLocaleString()}</p></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ title, value, sub, icon: Icon, color, pct }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string; pct: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">{title}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-foreground-subtle mt-0.5">{sub}</p>}
      {pct > 0 && (
        <div className="mt-3 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
    </motion.div>
  );
}
