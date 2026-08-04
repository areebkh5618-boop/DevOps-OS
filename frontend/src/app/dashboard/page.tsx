"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Cpu, HardDrive, MemoryStick, Box, Ship, GitBranch,
  Activity, CheckCircle2, XCircle, Clock, Server
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { dashboardApi } from "@/lib/api";
import { formatBytes, formatPercent } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const MOCK_CPU_HISTORY = Array.from({ length: 20 }, (_, i) => ({
  time: `${i}m`,
  cpu: 20 + Math.random() * 40,
  mem: 40 + Math.random() * 30,
}));

const PIPELINE_COLORS = ["#34d399", "#fb7185", "#fbbf24"];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => (await dashboardApi.overview()).data,
    refetchInterval: 30000,
  });

  const overview = data || {
    system: { cpu_percent: 32, memory: { percent: 58, total: 16000000000, used: 9000000000 }, disk: { percent: 45, total: 500000000000, used: 225000000000 }, hostname: "devverse-host", os: "Linux" },
    docker: { available: true, running_containers: 3 },
    kubernetes: { available: true },
    github: { available: false },
    health_score: 85,
    recent_containers: [],
    recent_deployments: [
      { name: "nginx", status: "success", time: "2 hours ago", namespace: "default" },
      { name: "api-server", status: "success", time: "5 hours ago", namespace: "default" },
      { name: "worker", status: "failed", time: "1 day ago", namespace: "prod" },
    ],
    pipeline_summary: { total: 42, success: 38, failed: 3, running: 1 },
  };

  const pipelineData = [
    { name: "Success", value: overview.pipeline_summary?.success || 0 },
    { name: "Failed", value: overview.pipeline_summary?.failed || 0 },
    { name: "Running", value: overview.pipeline_summary?.running || 0 },
  ];

  return (
    <DashboardLayout>
      <Header title="Dashboard" subtitle="System overview and health" />
      
      <div className="p-6 space-y-6">
        {/* Health + Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Health Score</span>
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{overview.health_score}</span>
              <span className="text-sm text-foreground-muted mb-1">/ 100</span>
            </div>
            <div className="mt-3 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent-cyan rounded-full transition-all duration-500"
                style={{ width: `${overview.health_score}%` }}
              />
            </div>
          </motion.div>

          <StatCard
            title="CPU Usage"
            value={formatPercent(overview.system?.cpu_percent || 0)}
            icon={Cpu}
            color="text-accent-cyan"
            delay={0.05}
          />
          <StatCard
            title="Memory"
            value={formatPercent(overview.system?.memory?.percent || 0)}
            sub={formatBytes(overview.system?.memory?.used || 0)}
            icon={MemoryStick}
            color="text-accent-violet"
            delay={0.1}
          />
          <StatCard
            title="Disk"
            value={formatPercent(overview.system?.disk?.percent || 0)}
            sub={formatBytes(overview.system?.disk?.used || 0)}
            icon={HardDrive}
            color="text-accent-amber"
            delay={0.15}
          />
        </div>

        {/* Service Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ServiceStatus name="Docker" available={overview.docker?.available} icon={Box} detail={`${overview.docker?.running_containers || 0} running`} />
          <ServiceStatus name="Kubernetes" available={overview.kubernetes?.available} icon={Ship} detail="Cluster connected" />
          <ServiceStatus name="GitHub" available={overview.github?.available} icon={GitBranch} detail="API linked" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-5 lg:col-span-2">
            <h3 className="text-sm font-medium mb-4">Resource Usage (Last 20 min)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={MOCK_CPU_HISTORY}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#6b6b7b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b7b" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ background: "#1a1a25", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#6366f1" fill="url(#cpuGrad)" strokeWidth={2} name="CPU" />
                <Area type="monotone" dataKey="mem" stroke="#22d3ee" fill="url(#memGrad)" strokeWidth={2} name="Memory" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card p-5">
            <h3 className="text-sm font-medium mb-4">Pipeline Summary</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pipelineData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {pipelineData.map((_, i) => (
                    <Cell key={i} fill={PIPELINE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a25", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {pipelineData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ background: PIPELINE_COLORS[i] }} />
                  <span className="text-foreground-muted">{d.name}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Recent Deployments */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-5">
          <h3 className="text-sm font-medium mb-4">Recent Deployments</h3>
          <div className="space-y-2">
            {(overview.recent_deployments || []).map((d: { name: string; status: string; time: string; namespace: string }, i: number) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  {d.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
                  ) : d.status === "failed" ? (
                    <XCircle className="w-4 h-4 text-accent-rose" />
                  ) : (
                    <Clock className="w-4 h-4 text-accent-amber" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-foreground-subtle">{d.namespace}</p>
                  </div>
                </div>
                <span className="text-xs text-foreground-muted">{d.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, sub, icon: Icon, color, delay }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">{title}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-foreground-subtle mt-1">{sub}</p>}
    </motion.div>
  );
}

function ServiceStatus({ name, available, icon: Icon, detail }: {
  name: string; available: boolean; icon: React.ElementType; detail: string;
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${available ? "bg-accent-emerald/15 text-accent-emerald" : "bg-foreground-subtle/15 text-foreground-subtle"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <span className={`status-dot ${available ? "status-running" : "status-stopped"}`} />
        </div>
        <p className="text-xs text-foreground-muted">{available ? detail : "Not connected"}</p>
      </div>
    </div>
  );
}
