"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge, MarkerType, useNodesState, useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { dockerApi, k8sApi } from "@/lib/api";
import { Network } from "lucide-react";

export default function NetworkPage() {
  const { data: containers = [] } = useQuery({
    queryKey: ["docker-containers"],
    queryFn: async () => (await dockerApi.containers(false)).data,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["k8s-services"],
    queryFn: async () => (await k8sApi.services("default")).data,
  });

  const { data: pods = [] } = useQuery({
    queryKey: ["k8s-pods"],
    queryFn: async () => (await k8sApi.pods("default")).data,
  });

  const { initialNodes, initialEdges } = useMemo(() => buildGraph(containers, services, pods), [containers, services, pods]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <DashboardLayout>
      <Header title="Network Visualizer" subtitle="Interactive graph of containers, pods & services" />
      <div className="p-6">
        <div className="glass-card overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-foreground-muted">
            <Network className="w-3.5 h-3.5 text-primary" />
            Live topology · drag nodes to rearrange
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: "#0a0a0f" }}
          >
            <Background color="#22222f" gap={20} />
            <Controls style={{ background: "#1a1a25", border: "1px solid rgba(255,255,255,0.08)" }} />
            <MiniMap
              style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
              nodeColor={(n) => (n.style?.background as string) || "#6366f1"}
            />
          </ReactFlow>
        </div>
      </div>
    </DashboardLayout>
  );
}

function buildGraph(containers: any[], services: any[], pods: any[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let y = 0;

  // Ingress node
  nodes.push({
    id: "ingress",
    position: { x: 250, y: 0 },
    data: { label: "🌐 Ingress / Gateway" },
    style: nodeStyle("#22d3ee"),
  });

  // Services
  services.slice(0, 5).forEach((s: any, i: number) => {
    const id = `svc-${s.name}`;
    nodes.push({
      id,
      position: { x: 80 + i * 180, y: 120 },
      data: { label: `⚡ ${s.name}\n${s.type || "ClusterIP"}` },
      style: nodeStyle("#a78bfa"),
    });
    edges.push({
      id: `e-ing-${id}`,
      source: "ingress",
      target: id,
      animated: true,
      style: { stroke: "#6366f1" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
    });
  });

  // Pods
  pods.slice(0, 6).forEach((p: any, i: number) => {
    const id = `pod-${p.name}`;
    nodes.push({
      id,
      position: { x: 40 + i * 160, y: 260 },
      data: { label: `📦 ${p.name.slice(0, 20)}\n${p.phase}` },
      style: nodeStyle(p.phase === "Running" ? "#34d399" : "#fbbf24"),
    });
    // Connect to first service if any
    if (services[0]) {
      edges.push({
        id: `e-svc-${id}`,
        source: `svc-${services[0].name}`,
        target: id,
        style: { stroke: "#6b6b7b" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6b6b7b" },
      });
    }
  });

  // Docker containers
  containers.slice(0, 5).forEach((c: any, i: number) => {
    const id = `ctr-${c.id}`;
    nodes.push({
      id,
      position: { x: 60 + i * 170, y: 400 },
      data: { label: `🐳 ${c.name}\n${c.state}` },
      style: nodeStyle(c.state === "running" ? "#6366f1" : "#6b6b7b"),
    });
  });

  if (nodes.length <= 1) {
    // fallback demo graph
    ["web", "api", "db", "cache"].forEach((n, i) => {
      nodes.push({
        id: n,
        position: { x: 100 + i * 180, y: 150 },
        data: { label: n },
        style: nodeStyle("#6366f1"),
      });
    });
    edges.push(
      { id: "e1", source: "ingress", target: "web", animated: true, style: { stroke: "#6366f1" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" } },
      { id: "e2", source: "web", target: "api", style: { stroke: "#6366f1" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" } },
      { id: "e3", source: "api", target: "db", style: { stroke: "#6366f1" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" } },
      { id: "e4", source: "api", target: "cache", style: { stroke: "#6366f1" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" } },
    );
  }

  return { initialNodes: nodes, initialEdges: edges };
}

function nodeStyle(color: string) {
  return {
    background: "#1a1a25",
    border: `1px solid ${color}`,
    borderRadius: 10,
    color: "#e8e8ed",
    fontSize: 11,
    padding: "8px 12px",
    minWidth: 120,
    textAlign: "center" as const,
    boxShadow: `0 0 12px ${color}33`,
  };
}
