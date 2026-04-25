"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, usePublicClient, useWriteContract } from "wagmi";
import { BaseError } from "viem";
import PostCard from "@/app/components/Card";
import BottomNav from "@/app/components/BottomNavbar";
import { fetchPostsByCreator, fetchUser, fetchWagersByUser, getBackendApiUrl } from "@/lib/backend";
import {
  formatDateTime,
  formatMon,
  formatPercent,
  parseMonAmount,
  shortenAddress,
  toFeedPost,
} from "@/lib/format";
import { refreshRoastWagerQueries } from "@/lib/query-sync";
import { requireRoastWagerAddress } from "@/lib/contracts";
import { roastWagerAbi } from "@/lib/roastWagerAbi";
import { useStakeToken } from "@/lib/useStakeToken";
import { useOptimisticRoastWager } from "@/lib/optimistic-roastwager";
import { useBetPreferences } from "@/lib/bet-preferences";
import { getLevelProgress, getLevelStakeCap } from "@/lib/leveling";

function EmptyProfileState() {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 text-center shadow-sm">
      <h1 className="mb-2 text-xl font-black text-[var(--text-main)]">Connect your wallet</h1>
      <p className="text-sm text-[var(--text-muted)]">
        Profile stats, your roasts, and wager history appear here once a wallet is connected.
      </p>
    </div>
  );
}

export default function Profile() {
  const { address, isConnected } = useAccount();
  const { tokenAddress, symbol, decimals, minBet } = useStakeToken();
  const { defaultAmount, setDefaultAmount } = useBetPreferences();
  const { optimisticVotes, pendingPosts } = useOptimisticRoastWager();
  const balanceQuery = useBalance({
    address,
    token: tokenAddress,
    query: { enabled: Boolean(address && tokenAddress) },
  });
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isClaimPending } = useWriteContract();

  const [claimStatus, setClaimStatus] = useState("");
  const [claimError, setClaimError] = useState("");
  const [activeView, setActiveView] = useState<"roasts" | "votes">("roasts");

  const userQuery = useQuery({
    queryKey: ["profile-user", address],
    queryFn: () => fetchUser(address!),
    enabled: Boolean(address),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 1500,
  });

  const postsQuery = useQuery({
    queryKey: ["profile-posts", address],
    queryFn: () => fetchPostsByCreator(address!, 50),
    enabled: Boolean(address),
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    staleTime: 1500,
  });

  const wagersQuery = useQuery({
    queryKey: ["profile-wagers", address],
    queryFn: () => fetchWagersByUser(address!, 100),
    enabled: Boolean(address),
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    staleTime: 1500,
  });

  const posts = useMemo(() => {
    const indexedPosts = (postsQuery.data ?? []).map((post) =>
      toFeedPost(post, optimisticVotes[post.id]?.choice ?? null),
    );
    const indexedKeys = new Set(
      indexedPosts.map((post) => `${post.address.toLowerCase()}::${post.content.trim()}`),
    );

    const pending = pendingPosts
      .filter(
        (post) =>
          post.ownerAddress.toLowerCase() === address?.toLowerCase() &&
          !indexedKeys.has(`${post.address.toLowerCase()}::${post.content.trim()}`),
      )
      .map((post) => ({ ...post, myVote: optimisticVotes[post.id]?.choice ?? post.myVote }));

    return [...pending, ...indexedPosts];
  }, [address, optimisticVotes, pendingPosts, postsQuery.data]);

  const wagerSummary = useMemo(() => {
    const wagers = wagersQuery.data ?? [];
    const settled = wagers.filter((wager) => ["win", "lose", "refund"].includes(wager.result));
    const wins = settled.filter((wager) => wager.result === "win").length;
    const totalStaked = wagers.reduce((sum, wager) => sum + Number(wager.amount), 0);
    const totalPayout = wagers.reduce((sum, wager) => sum + Number(wager.payout ?? 0), 0);

    return {
      total: wagers.length,
      wins,
      settled: settled.length,
      winRate: settled.length === 0 ? 0 : (wins / settled.length) * 100,
      totalStaked: totalStaked > 0 ? formatMon(totalStaked.toString(), decimals, symbol) : `0 ${symbol}`,
      totalPayout: totalPayout > 0 ? formatMon(totalPayout.toString(), decimals, symbol) : `0 ${symbol}`,
    };
  }, [decimals, symbol, wagersQuery.data]);

  const voteHistory = useMemo(
    () =>
      (wagersQuery.data ?? []).map((wager) => ({
        ...wager,
        amountLabel: formatMon(wager.amount, decimals, symbol),
        payoutLabel: wager.payout ? formatMon(wager.payout, decimals, symbol) : null,
        timestampLabel: formatDateTime(wager.timestamp),
        pnl: parseMonAmount(wager.payout, decimals) - parseMonAmount(wager.amount, decimals),
      })),
    [decimals, symbol, wagersQuery.data],
  );

  const claimableWagers = useMemo(
    () =>
      (wagersQuery.data ?? []).filter(
        (wager) => (wager.result === "win" || wager.result === "refund") && wager.payout === null,
      ),
    [wagersQuery.data],
  );

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] pb-24 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-5 lg:px-6">
          <EmptyProfileState />
        </div>
        <BottomNav />
      </div>
    );
  }

  const isLoading = userQuery.isLoading || postsQuery.isLoading || wagersQuery.isLoading;
  const hasError = userQuery.isError || postsQuery.isError || wagersQuery.isError;
  const displayName = shortenAddress(address, 6);
  const level = userQuery.data?.level ?? 1;
  const experience = userQuery.data?.experience ?? 0;
  const levelCap = getLevelStakeCap(level);
  const levelProgress = getLevelProgress(level, experience);
  const minBetAmount = minBet ? Number(minBet) / 10 ** decimals : 0.01;
  const sliderMax = Math.max(minBetAmount, levelCap);

  const normalizeBetAmount = (rawValue: string) => {
    const normalized = rawValue.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return defaultAmount;
    const clamped = Math.min(Math.max(parsed, minBetAmount), sliderMax);
    return clamped.toFixed(3).replace(/\.?0+$/, "");
  };

  const handleClaim = async (postIds: string[]) => {
    if (!address || !publicClient || postIds.length === 0) return;

    try {
      setClaimError("");
      const uniqueIds = [...new Set(postIds)];

      for (const postId of uniqueIds) {
        setClaimStatus(`Claiming reward for post ${postId}...`);
        const hash = await writeContractAsync({
          address: requireRoastWagerAddress(),
          abi: roastWagerAbi,
          functionName: "claim",
          args: [BigInt(postId)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`Claim reverted for post ${postId}`);
      }

      setClaimStatus("Confirmed. Waiting for backend sync...");
      await refreshRoastWagerQueries(queryClient, address);
      setClaimStatus("");
    } catch (error) {
      const message =
        error instanceof BaseError
          ? error.shortMessage || error.message
          : error instanceof Error
            ? error.message
            : "Failed to claim rewards";
      setClaimError(message);
      setClaimStatus("");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24 lg:pb-4">
      <div className="mx-auto max-w-6xl px-4 py-5 lg:h-[calc(100vh-1rem)] lg:px-6 lg:py-4">
        <div className="grid gap-5 lg:h-full lg:grid-cols-12">
          <aside className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-black text-white">
            {address.slice(2, 4).toUpperCase()}
          </div>

          <h1 className="mb-1 text-center text-2xl font-black text-[var(--text-main)]">{displayName}</h1>
          <p className="mb-4 text-center text-sm text-[var(--text-muted)]">Synced from RoastWager backend ({getBackendApiUrl()}).</p>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[var(--bg-main)] p-3 text-center">
              <p className="mb-1 text-xs font-bold text-[var(--primary-soft)]">Balance</p>
              <p className="text-lg font-black text-[var(--text-main)]">
                {balanceQuery.data ? formatMon(balanceQuery.data.value.toString(), decimals, symbol) : "..."}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-main)] p-3 text-center">
              <p className="mb-1 text-xs font-bold text-[var(--primary-soft)]">Level</p>
              <p className="text-xl font-black text-[var(--text-main)]">{level}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-main)] p-3 text-center">
              <p className="mb-1 text-xs font-bold text-[var(--primary-soft)]">Win Rate</p>
              <p className="text-xl font-black text-[var(--text-main)]">{formatPercent(wagerSummary.winRate)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3">
              <p className="text-[var(--text-muted)]">Experience</p>
              <p className="mt-1 text-lg font-black">{experience} XP</p>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3">
              <p className="text-[var(--text-muted)]">Roasts Created</p>
              <p className="mt-1 text-lg font-black">{posts.length}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3">
              <p className="text-[var(--text-muted)]">Total Staked</p>
              <p className="mt-1 text-lg font-black">{wagerSummary.totalStaked}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3">
              <p className="text-[var(--text-muted)]">Total Payout</p>
              <p className="mt-1 text-lg font-black">{wagerSummary.totalPayout}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-main)]">Level Progress</span>
              <span className="text-[var(--text-muted)]">
                {levelProgress.nextLevelXp
                  ? `${levelProgress.remainingXp} XP to Lv ${level + 1}`
                  : "Max level reached"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
              <div
                className="h-full rounded-full bg-[var(--primary-soft)] transition-all"
                style={{ width: `${levelProgress.progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              Stake cap for current level: <span className="font-semibold text-[var(--text-main)]">{levelCap} {symbol}</span>
            </div>
          </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-[var(--text-main)]">Bet Preference</h2>
            <span className="rounded-full bg-[var(--bg-main)] px-3 py-2 text-xs font-bold text-[var(--primary-soft)]">
              {defaultAmount} {symbol}
            </span>
          </div>
          <input
            type="range"
            min={minBetAmount}
            max={sliderMax}
            step={0.001}
            value={Math.min(Math.max(Number(defaultAmount) || minBetAmount, minBetAmount), sliderMax)}
            onChange={(event) => setDefaultAmount(normalizeBetAmount(event.target.value))}
            className="w-full accent-[var(--primary-soft)]"
          />
          <div className="mt-3 flex items-center gap-3">
            <input
              inputMode="decimal"
              value={defaultAmount}
              onChange={(event) => setDefaultAmount(event.target.value.replace(",", "."))}
              onBlur={(event) => setDefaultAmount(normalizeBetAmount(event.target.value))}
              className="w-28 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2 text-sm font-semibold outline-none"
            />
            <span className="text-xs text-[var(--text-muted)]">
              Auto-clamped by level cap
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Min {minBetAmount} {symbol}</span>
            <span>Lv {level} Max {sliderMax} {symbol}</span>
          </div>
            </div>

            {isLoading && (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
                Loading profile...
              </div>
            )}

            {hasError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                Failed to load profile data from `{getBackendApiUrl()}`.
              </div>
            )}

          </aside>

          <section className="space-y-4 lg:col-span-7 lg:flex lg:min-h-0 lg:flex-col">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-main)]">Claimable Rewards</h2>
                  <p className="text-sm text-[var(--text-muted)]">{claimableWagers.length} rewards ready to claim</p>
                </div>
                <button
                  disabled={claimableWagers.length === 0 || isClaimPending}
                  onClick={() => handleClaim(claimableWagers.map((wager) => wager.postId))}
                  className="rounded-xl bg-[var(--primary-soft)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {isClaimPending ? "Pending" : "Claim All"}
                </button>
              </div>

              <div className="space-y-2">
                {claimableWagers.length === 0 ? (
                  <div className="rounded-xl bg-[var(--bg-main)] p-3 text-sm text-[var(--text-muted)]">No rewards ready yet.</div>
                ) : (
                  claimableWagers.slice(0, 3).map((wager) => (
                    <div key={wager.id} className="flex items-center justify-between rounded-xl bg-[var(--bg-main)] p-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-main)]">{wager.result === "refund" ? "Refund" : "Winning reward"}</p>
                        <p className="text-xs text-[var(--text-muted)]">Post {wager.postId}</p>
                      </div>
                      <button
                        disabled={isClaimPending}
                        onClick={() => handleClaim([wager.postId])}
                        className="rounded-lg border border-[var(--primary-soft)] px-3 py-2 text-xs font-bold text-[var(--primary-soft)] disabled:opacity-40"
                      >
                        Claim
                      </button>
                    </div>
                  ))
                )}
              </div>

              {(claimStatus || claimError) && (
                <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3 text-sm">
                  {claimStatus && <p className="text-[var(--text-main)]">{claimStatus}</p>}
                  {claimError && <p className="text-red-300">{claimError}</p>}
                </div>
              )}
            </div>

            <div className="mb-0 flex gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2">
              <button
                onClick={() => setActiveView("roasts")}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition ${activeView === "roasts" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}
            >
              Your Roasts
            </button>
            <button
              onClick={() => setActiveView("votes")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition ${activeView === "votes" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}
            >
              Vote History
            </button>
            </div>

            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {activeView === "roasts" ? (
                <div className="flex flex-col gap-4">
                  {!isLoading && posts.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">No roasts indexed for this address yet.</div>
                  ) : (
                    posts.map((post) => <PostCard key={post.id} post={post} />)
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {!isLoading && voteHistory.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">No vote history indexed for this address yet.</div>
                  ) : (
                    voteHistory.map((wager) => (
                      <div key={wager.id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[var(--text-main)]">{wager.side === "bull" ? "Agree" : "Nah"}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{wager.timestampLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--text-main)]">{wager.amountLabel}</p>
                        <p className={`text-xs font-semibold ${wager.result === "win" ? "text-emerald-300" : wager.result === "lose" ? "text-red-300" : wager.result === "refund" ? "text-yellow-300" : "text-[var(--text-muted)]"}`}>
                          {wager.result.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <p className="mb-3 line-clamp-2 text-sm text-[var(--text-main)]">{`Post #${wager.postId}`}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-[var(--bg-main)] p-3">
                        <p className="text-[var(--text-muted)]">Stake</p>
                        <p className="mt-1 font-bold text-[var(--text-main)]">{wager.amountLabel}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--bg-main)] p-3">
                        <p className="text-[var(--text-muted)]">Payout</p>
                        <p className="mt-1 font-bold text-[var(--text-main)]">{wager.payoutLabel ?? "Pending"}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--bg-main)] p-3">
                        <p className="text-[var(--text-muted)]">PnL</p>
                        <p className={`mt-1 font-bold ${wager.pnl > 0 ? "text-emerald-300" : wager.pnl < 0 ? "text-red-300" : "text-[var(--text-main)]"}`}>
                          {wager.payoutLabel ? `${wager.pnl > 0 ? "+" : ""}${wager.pnl.toFixed(3)} ${symbol}` : "Pending"}
                        </p>
                      </div>
                    </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
