"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { FileEdit, Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const SAMPLES: Record<string, { lang: string; content: string }> = {
  "deployment.yaml": {
    lang: "yaml",
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: default
  labels:
    app: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: devverse/api:v1.2
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
`,
  },
  "service.yaml": {
    lang: "yaml",
    content: `apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
`,
  },
  "config.json": {
    lang: "json",
    content: `{
  "name": "devverse",
  "version": "1.0.0",
  "environment": "production",
  "features": {
    "docker": true,
    "kubernetes": true,
    "github": true
  },
  "replicas": 3,
  "resources": {
    "cpu": "500m",
    "memory": "512Mi"
  }
}
`,
  },
  ".env": {
    lang: "ini",
    content: `SECRET_KEY=change-me
DATABASE_URL=postgresql://devverse:devverse@db:5432/devverse
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DEBUG=false
`,
  },
};

export default function EditorPage() {
  const [file, setFile] = useState("deployment.yaml");
  const [content, setContent] = useState(SAMPLES["deployment.yaml"].content);
  const [copied, setCopied] = useState(false);

  const selectFile = (name: string) => {
    setFile(name);
    setContent(SAMPLES[name]?.content || "");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <Header title="File Editor" subtitle="Monaco editor for YAML, JSON & env files" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(SAMPLES).map((name) => (
            <button
              key={name}
              onClick={() => selectFile(name)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-mono transition-all",
                file === name ? "bg-primary/15 text-primary border border-primary/30" : "bg-background-tertiary text-foreground-muted hover:text-foreground border border-border"
              )}
            >
              {name}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={copy} className="btn-secondary flex items-center gap-1.5 text-sm">
            {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            Copy
          </button>
          <button onClick={download} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-foreground-muted">
            <FileEdit className="w-3.5 h-3.5" />
            {file}
            <span className="ml-auto capitalize">{SAMPLES[file]?.lang}</span>
          </div>
          <Monaco
            height="520px"
            language={SAMPLES[file]?.lang === "ini" ? "plaintext" : SAMPLES[file]?.lang}
            theme="vs-dark"
            value={content}
            onChange={(v) => setContent(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
