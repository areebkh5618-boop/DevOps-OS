"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { githubApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function RepoDetailPage() {
  // Use Next client hook to read route params in client components.
  const params = useParams() as { owner: string; repo: string } | null;
  const owner = params?.owner ?? "";
  const repo = params?.repo ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["github-repo", owner, repo],
    queryFn: async () => (await githubApi.getRepo(owner, repo)).data,
    enabled: Boolean(owner && repo),
  });

  return (
    <DashboardLayout>
      <Header title={data ? data.full_name : "Repository"} subtitle={data?.description || ""} />
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-2">Repository</h2>
            <p className="text-sm text-foreground-muted mb-4">Unable to load repository.</p>
            {/** If unauthenticated, prompt to connect GitHub */}
            {/* @ts-ignore-next-line */}
            {error?.response?.status === 401 ? (
              <div className="space-y-3">
                <p className="text-sm">You need to connect your GitHub account to view this repository.</p>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/github`}
                  className="btn-primary"
                >
                  Connect GitHub
                </a>
              </div>
            ) : (
              <div className="text-sm text-foreground-muted">An error occurred. Try refreshing the page.</div>
            )}
          </div>
        ) : (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-2">{data?.full_name}</h2>
            <p className="text-sm text-foreground-muted mb-4">{data?.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Stars:</strong> {data?.stargazers_count ?? "-"}</div>
              <div><strong>Forks:</strong> {data?.forks_count ?? "-"}</div>
              <div><strong>Language:</strong> {data?.language ?? "-"}</div>
              <div><strong>Private:</strong> {data?.private ? 'Yes' : 'No'}</div>
            </div>
            <div className="mt-4">
              <a href={data?.html_url} target="_blank" rel="noopener" className="btn-secondary">Open on GitHub</a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
