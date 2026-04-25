"use client";

import WagerModal from "./WagerModal";
import { Share2, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { BaseError } from "viem";
import { formatMon, shortenAddress } from "@/lib/format";
import { refreshRoastWagerQueries } from "@/lib/query-sync";
import { roastWagerAbi } from "@/lib/roastWagerAbi";
import { requireRoastWagerAddress } from "@/lib/contracts";
import { useStakeToken } from "@/lib/useStakeToken";
import { useBetPreferences } from "@/lib/bet-preferences";
import type { FeedPost } from "@/lib/types";

function getInitial(address: string) {
  if (!address) return "U";

  const clean = address.toLowerCase().startsWith("0x")
    ? address.slice(2)
    : address;

  // ambil huruf pertama (bukan angka)
  const letter = clean.replace(/[^a-zA-Z]/g, "").charAt(0);

  return letter ? letter.toUpperCase() : "U";
}

function getSafeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export default function PostCard({
  post,
  isInExplorer = false,
}: {
  post: FeedPost;
  isInExplorer?: boolean;
}) {
  const [showModal, setShowModal] = useState<"agree" | "disagree" | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [resolveStatus, setResolveStatus] = useState("");
  const [resolveError, setResolveError] = useState("");
  const showBlindStats = post.status !== "active";
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { symbol, decimals } = useStakeToken();
  const { defaultAmount } = useBetPreferences();
  const canResolve =
    post.status === "active" && post.timeLeft === "Ended" && !post.isPending;
  const safeImageUrl = useMemo(() => getSafeImageUrl(post.imageUrl), [post.imageUrl]);
  const canShowImage = Boolean(safeImageUrl && safeImageUrl !== failedImageUrl);

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      await navigator.share({
        title: "RoastWager Market",
        text: post.content,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
  };

  const handleResolve = async () => {
    if (!publicClient) {
      setResolveError("Public client is not ready.");
      return;
    }

    try {
      setResolveError("");
      setResolveStatus("Submitting resolve transaction...");
      const hash = await writeContractAsync({
        address: requireRoastWagerAddress(),
        abi: roastWagerAbi,
        functionName: "resolve",
        args: [BigInt(post.id)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("Resolve transaction reverted");
      setResolveStatus("Resolved. Waiting for backend sync...");
      await refreshRoastWagerQueries(queryClient, address);
      setResolveStatus("");
    } catch (error) {
      const message =
        error instanceof BaseError
          ? error.shortMessage || error.message
          : error instanceof Error
            ? error.message
            : "Failed to resolve market";
      setResolveError(message);
      setResolveStatus("");
    }
  };

  return (
    <>
      <div className="w-full bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] shadow-sm p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          {/* Left */}
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center
                bg-[#2a2a2e]
                text-white text-sm font-bold
                shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            >
              {getInitial(post.address)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="flex items-center gap-1 bg-[var(--text-muted)]/10 text-[var(--primary-soft)] px-2 py-1 rounded-full text-xs font-semibold">
                  {shortenAddress(post.address)}
                </p>
                {typeof post.level === "number" && (
                  <span className="rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--primary-soft)]">
                    Lv {post.level}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {post.isPending ? "pending" : post.status}
            </p>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-[var(--text-main)] mb-3 leading-relaxed">
          {post.content}
        </p>

        {/* Image */}
        {!isInExplorer && canShowImage && safeImageUrl && (
          <button
            type="button"
            onClick={() => setIsImagePreviewOpen(true)}
            className="mb-3 block w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)]"
          >
            <img
              src={safeImageUrl}
              alt="Roast image"
              loading="lazy"
              onError={() => setFailedImageUrl(safeImageUrl)}
              className="max-h-[28rem] w-full object-contain lg:max-h-[20rem]"
            />
          </button>
        )}
        {showBlindStats && (
            <div className="mb-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)]/80 px-3 py-2 text-xs text-[var(--text-muted)]">
                <div className="flex items-center justify-between gap-2">
                  <span>Bull {post.bullCount ?? 0} bettors</span>
                  <span>{formatMon(post.bullPool, decimals, symbol)}</span>
                  <span>Bear {post.bearCount ?? 0} bettors</span>
                  <span>{formatMon(post.bearPool, decimals, symbol)}</span>
                </div>
            </div>
        )}

        <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link
            href={`/post/${post.id}`}
            className="font-semibold text-[var(--primary-soft)]"
          >
            Open market
          </Link>
          <button onClick={handleShare} className="flex items-center gap-1">
            <Share2 size={14} />
            Share
          </button>
        </div>

        {!isInExplorer &&
          post.status === "active" &&
          !canResolve &&
          !post.isPending &&
          !post.myVote && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal("agree")}
                className="flex-1 flex items-center justify-center gap-2
              bg-[var(--primary-soft)]
              text-gray-300
              py-2.5 rounded-xl text-xs font-bold
              transition active:scale-95
              hover:bg-[var(--primary)]/25"
              >
                <ThumbsUp size={16} />
                Agree
              </button>

              <button
                onClick={() => setShowModal("disagree")}
                className="flex-1 flex items-center justify-center gap-2
            bg-[var(--border-soft)]
            text-gray-300
            py-2.5 rounded-xl text-xs font-bold
            transition active:scale-95 hover:bg-[#2a2a35]"
              >
                <ThumbsDown size={16} />
                Nah
              </button>
            </div>
          )}

        {!isInExplorer && post.status === "active" && post.myVote && (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-center text-xs font-semibold text-[var(--primary-soft)]">
            Wager placed. You already backed the{" "}
            {post.myVote === "agree" ? "Agree" : "Nah"} side.
          </div>
        )}

        {!isInExplorer && post.isPending && (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-center text-xs font-semibold text-[var(--primary-soft)]">
            Transaction confirmed. Waiting for backend to publish this market.
          </div>
        )}

        {!isInExplorer && canResolve && (
          <div className="space-y-3">
            <button
              onClick={handleResolve}
              disabled={isPending}
              className="w-full rounded-xl bg-[var(--primary-soft)] py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {isPending ? "Resolving..." : "Resolve Market"}
            </button>
            {(resolveStatus || resolveError) && (
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2 text-xs">
                {resolveStatus && (
                  <p className="text-[var(--text-main)]">{resolveStatus}</p>
                )}
                {resolveError && <p className="text-red-300">{resolveError}</p>}
              </div>
            )}
          </div>
        )}

        {!isInExplorer && post.status !== "active" && (
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2 text-center text-xs font-semibold text-[var(--text-muted)]">
            {post.status === "refunded"
              ? "This market was refunded"
              : `Settled ${post.winningSide === 1 ? "Bull" : "Bear"} side won`}
          </div>
        )}
      </div>

      <WagerModal
        key={`${post.id}:${defaultAmount}`}
        open={!!showModal}
        type={showModal}
        onClose={() => setShowModal(null)}
        content={post.content}
        postId={post.id}
        initialAmount={defaultAmount}
      />

      {isImagePreviewOpen && safeImageUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            onClick={() => setIsImagePreviewOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
          >
            <X size={18} />
          </button>
          <img
            src={safeImageUrl}
            alt="Roast full image"
            className="max-h-[92vh] w-auto max-w-[92vw] rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}
