"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import PostCard from "../components/Card";
import BottomNav from "../components/BottomNavbar";
import CreatePostModal from "../components/CreatePostModal";
import { Plus } from "lucide-react";
import { fetchPosts, fetchWagersByUser, getBackendApiUrl } from "@/lib/backend";
import { toFeedPost } from "@/lib/format";
import type { FeedPost, IndexerPost, PostStatus } from "@/lib/types";
import { useOptimisticRoastWager } from "@/lib/optimistic-roastwager";
import { useStakeToken } from "@/lib/useStakeToken";

const categories = ["All", "Active", "Settled", "Refunded"] as const;

function scorePost(post: IndexerPost, decimals: number) {
  const bull = Number(post.bullCount ?? 0);
  const bear = Number(post.bearCount ?? 0);
  const pool = Number(post.bullPool ?? 0) + Number(post.bearPool ?? 0);
  return bull + bear + pool / 10 ** decimals;
}

function toSourcePost(post: FeedPost): IndexerPost {
  return {
    id: post.id,
    creator: post.address,
    content: post.content,
    imageUrl: post.imageUrl,
    endTime: "0",
    status: post.status,
    winningSide: post.winningSide,
    bullPool: post.bullPool,
    bearPool: post.bearPool,
    bullCount: post.bullCount,
    bearCount: post.bearCount,
    createdAt: post.createdAt,
  };
}

export default function ExplorePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [search, setSearch] = useState("");
  const { address } = useAccount();
  const { optimisticVotes, pendingPosts } = useOptimisticRoastWager();
  const { decimals } = useStakeToken();

  const postsQuery = useQuery({
    queryKey: ["explore-posts"],
    queryFn: () => fetchPosts(50),
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    staleTime: 1500,
  });

  const wagersQuery = useQuery({
    queryKey: ["explore-my-wagers", address],
    queryFn: () => fetchWagersByUser(address!, 100),
    enabled: Boolean(address),
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    staleTime: 1500,
  });

  const feedPosts = useMemo(() => {
    const myVotes = new Map(
      (wagersQuery.data ?? []).map((wager) => [wager.postId, wager.side === "bull" ? "agree" : "disagree"] as const),
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

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedStatus = activeCategory === "All" ? null : activeCategory.toLowerCase() as PostStatus;

    return feedPosts.filter((post) => {
      const categoryMatch = !selectedStatus || post.status === selectedStatus;
      const searchMatch =
        query.length === 0 ||
        post.content.toLowerCase().includes(query) ||
        post.address.toLowerCase().includes(query);

      return categoryMatch && searchMatch;
    });
  }, [activeCategory, feedPosts, search]);

  const trendingPosts = useMemo(() => {
    const settled = filteredPosts.filter((post) => post.status !== "active");
    return settled
          .sort((a, b) => {
            const sourceA = postsQuery.data?.find((post) => post.id === a.id);
            const sourceB = postsQuery.data?.find((post) => post.id === b.id);
            return scorePost(sourceB ?? toSourcePost(b), decimals) - scorePost(sourceA ?? toSourcePost(a), decimals);
          })
          .slice(0, 3);
  }, [decimals, filteredPosts, postsQuery.data]);

  const discoveryPosts = useMemo(() => {
    const active = filteredPosts.filter((post) => post.status === "active");

    return active
      .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
      .reverse();
  }, [filteredPosts]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24 lg:h-full lg:min-h-0 lg:pb-4">
      <div className="mx-auto max-w-6xl px-4 py-5 lg:h-full lg:px-6 lg:py-4">
        <div className="grid gap-5 lg:h-full lg:grid-cols-12">
          <aside className="space-y-4 lg:col-span-4">
            <h1 className="text-2xl font-black">Explore</h1>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bets, users..."
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
            />

            <div className="flex gap-2 overflow-x-auto lg:flex-wrap">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    activeCategory === category
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-muted)]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]">
              Viral ranks closed markets by revealed participation and pool size. Discover prioritizes active markets and fresh takes.
            </div>
          </aside>

          <section className="space-y-6 lg:col-span-8 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            {postsQuery.isLoading && (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
                Loading explore feed...
              </div>
            )}

            {postsQuery.isError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                Failed to load backend data from `{getBackendApiUrl()}`.
              </div>
            )}

            {!postsQuery.isLoading && !postsQuery.isError && (
              <>
                <div>
                  <h2 className="mb-3 text-lg font-bold">Viral Bets</h2>
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] [&>div>div]:rounded-none [&>div>div]:border-0 [&>div>div]:shadow-none">
                    {trendingPosts.length === 0 ? (
                      <div className="p-4 text-sm text-[var(--text-muted)]">No settled markets are viral yet.</div>
                    ) : (
                      trendingPosts.map((post, index) => (
                        <div
                          key={post.id}
                          className={index !== 0 ? "border-t border-[var(--border-soft)]" : ""}
                        >
                          <PostCard post={post} isInExplorer />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 text-lg font-bold">Discover</h2>
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] [&>div>div]:rounded-none [&>div>div]:border-0 [&>div>div]:shadow-none">
                    {discoveryPosts.length === 0 ? (
                      <div className="p-4 text-sm text-[var(--text-muted)]">No active markets found.</div>
                    ) : (
                      discoveryPosts.map((post, index) => (
                        <div
                          key={post.id}
                          className={index !== 0 ? "border-t border-[var(--border-soft)]" : ""}
                        >
                          <PostCard post={post} isInExplorer />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
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
