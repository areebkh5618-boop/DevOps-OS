"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setTokens, fetchUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const access = params?.get("access_token");
    const refresh = params?.get("refresh_token");
    const err = params?.get("error");

    if (err) {
      setError(err);
      setTimeout(() => router.push("/login"), 2500);
      return;
    }

    if (access && refresh) {
      setTokens(access, refresh);
      fetchUser()
        .then(() => router.push("/dashboard"))
        .catch(() => {
          setError("Failed to load user");
          setTimeout(() => router.push("/login"), 2500);
        });
    } else {
      setError("Missing tokens");
      setTimeout(() => router.push("/login"), 2500);
    }
  }, [setTokens, fetchUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-accent-rose mb-2">Authentication failed: {error}</p>
            <p className="text-sm text-foreground-muted">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-foreground-muted">Completing GitHub login...</p>
          </>
        )}
      </div>
    </div>
  );
}
