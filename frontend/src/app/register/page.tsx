"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", username: "", password: "", full_name: "" });
  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
      toast.success("Account created successfully");
      router.push("/dashboard");
    } catch {
      toast.error("Registration failed. Email or username may already exist.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent-violet/10 rounded-full blur-[128px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 shadow-glow">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-sm text-foreground-muted mt-1">Join DevVerse and start managing infrastructure</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground-muted mb-1.5 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input-field pl-10"
                  placeholder="John Doe"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted mb-1.5 block">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-field pl-10"
                  placeholder="johndoe"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-muted mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field pl-10"
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-foreground-muted mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:text-primary-hover">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
