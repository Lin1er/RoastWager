"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import PostCard from "./components/Card";
import BottomNav from "./components/BottomNavbar";
import { Plus } from "lucide-react";
import CreatePostModal from "./components/CreatePostModal";
import { fetchPosts, fetchWagersByUser, getBackendApiUrl } from "@/lib/backend";
import { toFeedPost } from "@/lib/format";
import { useOptimisticRoastWager } from "@/lib/optimistic-roastwager";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const { address } = useAccount();
  const { optimisticVotes, pendingPosts } = useOptimisticRoastWager();

  const postsQuery = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchPosts(20),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    staleTime: 10000,
  });

  const wagersQuery = useQuery({
    queryKey: ["profile-wagers", address],
    queryFn: () => fetchWagersByUser(address!, 100),
    enabled: Boolean(address),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    staleTime: 10000,
  });

  const feedPosts = useMemo(() => {
    const myVotes = new Map(
      (wagersQuery.data ?? []).map((wager) => [
        wager.postId,
        wager.side === "bull" ? "agree" : "disagree",
      ] as const),
    );

    const indexedPosts = (postsQuery.data ?? []).map((post) =>
      toFeedPost(post, optimisticVotes[post.id]?.choice ?? myVotes.get(post.id) ?? null),
    );

    const indexedKeys = new Set(
      indexedPosts.map((post) => `${post.address.toLowerCase()}::${post.content.trim()}`),
    );

    const pending = pendingPosts
      .filter((post) => !indexedKeys.has(`${post.address.toLowerCase()}::${post.content.trim()}`))
      .map((post) => ({ ...post, myVote: optimisticVotes[post.id]?.choice ?? post.myVote }));

    return [...pending, ...indexedPosts];
  }, [optimisticVotes, pendingPosts, postsQuery.data, wagersQuery.data]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24 lg:h-full lg:min-h-0 lg:pb-4">
      <div className="mx-auto max-w-6xl px-4 py-5 lg:h-full lg:px-6 lg:py-4">
          <section className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
            {postsQuery.isLoading && (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
                Loading live markets...
              </div>
            )}

            {postsQuery.isError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                Failed to load backend data from `{getBackendApiUrl()}`.
              </div>
            )}

            {!postsQuery.isLoading && !postsQuery.isError && feedPosts.length === 0 && (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
                No roasts indexed yet.
              </div>
            )}

            <div className="flex flex-col gap-4">
              {feedPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
      </div>

      <BottomNav />

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg transition hover:bg-[var(--primary-soft)] active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus size={24} />
      </button>

      <CreatePostModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
