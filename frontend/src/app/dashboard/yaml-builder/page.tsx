"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { FileCode, Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Kind = "Deployment" | "Service" | "Ingress" | "ConfigMap" | "Secret" | "PersistentVolumeClaim";

const KINDS: Kind[] = ["Deployment", "Service", "Ingress", "ConfigMap", "Secret", "PersistentVolumeClaim"];

export default function YamlBuilderPage() {
  const [kind, setKind] = useState<Kind>("Deployment");
  const [name, setName] = useState("my-app");
  const [namespace, setNamespace] = useState("default");
  const [image, setImage] = useState("nginx:1.25");
  const [replicas, setReplicas] = useState(3);
  const [port, setPort] = useState(80);
  const [targetPort, setTargetPort] = useState(8080);
  const [host, setHost] = useState("app.example.com");
  const [copied, setCopied] = useState(false);

  const yaml = useMemo(() => generateYaml({ kind, name, namespace, image, replicas, port, targetPort, host }), [
    kind, name, namespace, image, replicas, port, targetPort, host,
  ]);

  const copy = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    toast.success("YAML copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${kind.toLowerCase()}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <Header title="YAML Builder" subtitle="Visual Kubernetes resource generator" />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> Resource</h3>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs transition-all", kind === k ? "bg-primary/15 text-primary border border-primary/30" : "bg-background-tertiary text-foreground-muted border border-border")}>
                  {k}
                </button>
              ))}
            </div>

            <Field label="Name" value={name} onChange={setName} />
            <Field label="Namespace" value={namespace} onChange={setNamespace} />

            {kind === "Deployment" && (
              <>
                <Field label="Image" value={image} onChange={setImage} />
                <Field label="Replicas" value={String(replicas)} onChange={(v) => setReplicas(Number(v) || 1)} type="number" />
                <Field label="Container Port" value={String(targetPort)} onChange={(v) => setTargetPort(Number(v) || 80)} type="number" />
              </>
            )}
            {kind === "Service" && (
              <>
                <Field label="Port" value={String(port)} onChange={(v) => setPort(Number(v) || 80)} type="number" />
                <Field label="Target Port" value={String(targetPort)} onChange={(v) => setTargetPort(Number(v) || 80)} type="number" />
              </>
            )}
            {kind === "Ingress" && (
              <Field label="Host" value={host} onChange={setHost} />
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={copy} className="btn-secondary flex items-center gap-1.5 text-sm flex-1 justify-center">
              {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />} Copy
            </button>
            <button onClick={download} className="btn-primary flex items-center gap-1.5 text-sm flex-1 justify-center">
              <Download className="w-3.5 h-3.5" /> Export YAML
            </button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-xs text-foreground-muted">Generated YAML</div>
          <Monaco
            height="520px"
            language="yaml"
            theme="vs-dark"
            value={yaml}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", scrollBeyondLastLine: false, padding: { top: 12 } }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-foreground-muted mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field text-sm" />
    </div>
  );
}

function generateYaml(p: {
  kind: Kind; name: string; namespace: string; image: string; replicas: number; port: number; targetPort: number; host: string;
}): string {
  const { kind, name, namespace, image, replicas, port, targetPort, host } = p;
  if (kind === "Deployment") {
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}
          ports:
            - containerPort: ${targetPort}
`;
  }
  if (kind === "Service") {
    return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  type: ClusterIP
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${targetPort}
      protocol: TCP
`;
  }
  if (kind === "Ingress") {
    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  rules:
    - host: ${host}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${name}
                port:
                  number: ${port}
`;
  }
  if (kind === "ConfigMap") {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
  namespace: ${namespace}
data:
  key: value
`;
  }
  if (kind === "Secret") {
    return `apiVersion: v1
kind: Secret
metadata:
  name: ${name}
  namespace: ${namespace}
type: Opaque
stringData:
  key: secret-value
`;
  }
  return `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
`;
}
