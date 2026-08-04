"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/15 rounded-full blur-[128px]" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Reset Password</h1>
            <p className="text-sm text-foreground-muted mt-1">Enter your email to receive a reset link</p>
          </div>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs font-medium text-foreground-muted mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <input type="email" className="input-field pl-10" placeholder="you@company.com" required />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5">Send Reset Link</button>
          </form>
          <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-foreground-muted mt-6 hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
