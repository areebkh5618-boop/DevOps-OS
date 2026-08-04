"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight, Loader2, Github } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading } = useAuthStore();
  const router = useRouter();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const errorParam = params?.get("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success("Welcome back to DevVerse");
      router.push("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    }
  };

  const handleGitHubLogin = () => {
    window.location.href = `${API_URL}/api/v1/auth/github`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-cyan/10 rounded-full blur-[128px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 shadow-glow">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to DevVerse</h1>
            <p className="text-sm text-foreground-muted mt-1">The Ultimate Browser-Based DevOps OS</p>
          </div>

          {errorParam && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-accent-rose/15 text-accent-rose text-sm text-center">
              GitHub login failed: {errorParam}
            </div>
          )}

          {/* GitHub OAuth */}
          <button
            type="button"
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#24292f] hover:bg-[#32383f] text-white font-medium transition-colors mb-4 border border-white/10"
          >
            <Github className="w-5 h-5" />
            Continue with GitHub
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-foreground-subtle">or email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground-muted mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground-muted mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-foreground-muted cursor-pointer">
                <input type="checkbox" className="rounded border-border" />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-primary hover:text-primary-hover transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-foreground-muted mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:text-primary-hover transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
