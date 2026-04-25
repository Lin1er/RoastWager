"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FeedPost, VoteChoice } from "./types";

type PendingPost = FeedPost & {
  optimisticId: string;
  ownerAddress: string;
  expiresAt: number;
};

type OptimisticVote = {
  choice: VoteChoice;
  expiresAt: number;
};

type OptimisticContextValue = {
  pendingPosts: PendingPost[];
  optimisticVotes: Record<string, OptimisticVote>;
  addPendingPost: (post: Omit<PendingPost, "optimisticId" | "expiresAt">) => void;
  addOptimisticVote: (postId: string, choice: VoteChoice) => void;
  removeOptimisticVote: (postId: string) => void;
};

const PENDING_TTL_MS = 120_000;

const OptimisticContext = createContext<OptimisticContextValue | null>(null);

export function OptimisticRoastWagerProvider({ children }: { children: React.ReactNode }) {
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [optimisticVotes, setOptimisticVotes] = useState<Record<string, OptimisticVote>>({});

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setPendingPosts((current) => current.filter((post) => post.expiresAt > now));
      setOptimisticVotes((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([, vote]) => vote.expiresAt > now),
        ),
      );
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const value = useMemo<OptimisticContextValue>(
    () => ({
      pendingPosts,
      optimisticVotes,
      addPendingPost: (post) => {
        setPendingPosts((current) => [
          {
            ...post,
            optimisticId: crypto.randomUUID(),
            expiresAt: Date.now() + PENDING_TTL_MS,
          },
          ...current,
        ]);
      },
      addOptimisticVote: (postId, choice) => {
        setOptimisticVotes((current) => ({
          ...current,
          [postId]: {
            choice,
            expiresAt: Date.now() + PENDING_TTL_MS,
          },
        }));
      },
      removeOptimisticVote: (postId) => {
        setOptimisticVotes((current) => {
          const next = { ...current };
          delete next[postId];
          return next;
        });
      },
    }),
    [optimisticVotes, pendingPosts],
  );

  return <OptimisticContext.Provider value={value}>{children}</OptimisticContext.Provider>;
}

export function useOptimisticRoastWager() {
  const context = useContext(OptimisticContext);
  if (!context) {
    throw new Error("useOptimisticRoastWager must be used within OptimisticRoastWagerProvider");
  }
  return context;
}
