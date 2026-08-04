"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Terminal as TermIcon, Trash2, Plug, Unplug, Box, Ship } from "lucide-react";
import { dockerApi, k8sApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TargetType = "docker" | "k8s" | "local";

function wsBase(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return api.replace(/^http/, "ws") + "/api/v1";
}

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [targetType, setTargetType] = useState<TargetType>("local");
  const [containerId, setContainerId] = useState("");
  const [podName, setPodName] = useState("");
  const [namespace, setNamespace] = useState("default");

  const { data: containers = [] } = useQuery({
    queryKey: ["docker-containers-term"],
    queryFn: async () => (await dockerApi.containers(true)).data,
  });

  const { data: pods = [] } = useQuery({
    queryKey: ["k8s-pods-term", namespace],
    queryFn: async () => (await k8sApi.pods(namespace)).data,
  });

  // Init xterm once
  useEffect(() => {
    let disposed = false;
    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // @ts-ignore
      await import("@xterm/xterm/css/xterm.css");
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        theme: {
          background: "#0a0a0f",
          foreground: "#e8e8ed",
          cursor: "#6366f1",
          selectionBackground: "rgba(99,102,241,0.3)",
          black: "#1a1a25",
          red: "#fb7185",
          green: "#34d399",
          yellow: "#fbbf24",
          blue: "#6366f1",
          magenta: "#a78bfa",
          cyan: "#22d3ee",
          white: "#e8e8ed",
        },
        allowProposedApi: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;
      setReady(true);

      term.writeln("\x1b[1;36mDevVerse Terminal\x1b[0m");
      term.writeln("Select a target above and click \x1b[1mConnect\x1b[0m.");
      term.writeln("• Local mock shell (always available)");
      term.writeln("• Docker container exec (needs Docker socket)");
      term.writeln("• Kubernetes pod exec (needs kubeconfig)\r\n");

      const onResize = () => {
        fit.fit();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      disposed = true;
      disconnect();
      termRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!termRef.current) return;
    disconnect();
    setConnecting(true);

    const term = termRef.current;
    fitRef.current?.fit();
    const cols = term.cols || 120;
    const rows = term.rows || 30;
    const token =
      (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";

    let url = "";
    if (targetType === "docker") {
      if (!containerId) {
        toast.error("Select a container");
        setConnecting(false);
        return;
      }
      url = `${wsBase()}/ws/terminal/docker?container_id=${encodeURIComponent(containerId)}&cols=${cols}&rows=${rows}&token=${encodeURIComponent(token)}`;
    } else if (targetType === "k8s") {
      if (!podName) {
        toast.error("Select a pod");
        setConnecting(false);
        return;
      }
      url = `${wsBase()}/ws/terminal/k8s?pod=${encodeURIComponent(podName)}&namespace=${encodeURIComponent(namespace)}&cols=${cols}&rows=${rows}&token=${encodeURIComponent(token)}`;
    } else {
      // Dedicated local mock shell — always works
      url = `${wsBase()}/ws/terminal/local?cols=${cols}&rows=${rows}&token=${encodeURIComponent(token)}`;
    }

    term.clear();
    term.writeln(`\x1b[90mConnecting to ${targetType}...\x1b[0m`);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      toast.success("Terminal connected");
      // Forward keystrokes
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    };

    ws.onmessage = (ev) => {
      term.write(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[31mWebSocket error\x1b[0m");
      toast.error("Connection failed");
      setConnecting(false);
      setConnected(false);
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[90m[disconnected]\x1b[0m");
      setConnected(false);
      setConnecting(false);
      wsRef.current = null;
    };
  }, [targetType, containerId, podName, namespace, disconnect]);

  const clearTerm = () => {
    termRef.current?.clear();
  };

  return (
    <DashboardLayout>
      <Header title="Terminal" subtitle="WebSocket shell — Docker exec & Kubernetes pod exec" />
      <div className="p-6 space-y-4">
        {/* Target selector */}
        <div className="glass-card p-4 flex flex-wrap items-end gap-3">
          <div className="flex gap-1 p-1 bg-background-secondary rounded-lg border border-border">
            {(
              [
                { id: "local" as TargetType, label: "Local", icon: TermIcon },
                { id: "docker" as TargetType, label: "Docker", icon: Box },
                { id: "k8s" as TargetType, label: "Kubernetes", icon: Ship },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTargetType(t.id)}
                disabled={connected}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all disabled:opacity-50",
                  targetType === t.id ? "bg-primary/15 text-primary" : "text-foreground-muted hover:text-foreground"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {targetType === "docker" && (
            <select
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              disabled={connected}
              className="input-field text-sm py-1.5 w-56"
            >
              <option value="">Select container...</option>
              {containers.map((c: { id: string; name: string; state: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.state})
                </option>
              ))}
            </select>
          )}

          {targetType === "k8s" && (
            <>
              <input
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                disabled={connected}
                className="input-field text-sm py-1.5 w-32"
                placeholder="namespace"
              />
              <select
                value={podName}
                onChange={(e) => setPodName(e.target.value)}
                disabled={connected}
                className="input-field text-sm py-1.5 w-56"
              >
                <option value="">Select pod...</option>
                {pods.map((p: { name: string; phase: string }) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.phase})
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs flex items-center gap-1.5",
                connected ? "text-accent-emerald" : "text-foreground-muted"
              )}
            >
              <span className={cn("status-dot", connected ? "status-running" : "status-stopped")} />
              {connecting ? "Connecting…" : connected ? "Connected" : ready ? "Ready" : "Init…"}
            </span>
            {connected ? (
              <button onClick={disconnect} className="btn-danger flex items-center gap-1.5 text-sm py-1.5">
                <Unplug className="w-3.5 h-3.5" /> Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={connecting || !ready}
                className="btn-primary flex items-center gap-1.5 text-sm py-1.5 disabled:opacity-50"
              >
                <Plug className="w-3.5 h-3.5" /> Connect
              </button>
            )}
            <button onClick={clearTerm} className="btn-secondary p-2" title="Clear">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="glass-card p-2 overflow-hidden">
          <div ref={containerRef} className="w-full min-h-[480px]" />
        </div>
      </div>
    </DashboardLayout>
  );
}
