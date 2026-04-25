"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchPost } from "@/lib/backend";
import { toFeedPost } from "@/lib/format";
import PostCard from "@/app/components/Card";
import BottomNav from "@/app/components/BottomNavbar";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;

  const postQuery = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId),
    enabled: Boolean(postId),
    refetchInterval: 4000,
  });

  const post = useMemo(() => (postQuery.data ? toFeedPost(postQuery.data) : null), [postQuery.data]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24 lg:pb-10">
      <div className="mx-auto max-w-5xl px-4 py-5 lg:px-6">
        <h1 className="mb-4 text-2xl font-black">Market</h1>
        <div className="mx-auto max-w-2xl">
          {post ? (
            <PostCard post={post} />
          ) : (
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
              {postQuery.isLoading ? "Loading market..." : "Market not found yet."}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
