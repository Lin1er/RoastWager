import { formatUnits } from "viem";
import { fallbackStableDecimals, fallbackStableSymbol } from "./stablecoin";
import type { FeedPost, IndexerPost, VoteChoice } from "./types";

export function shortenAddress(address: string, width = 4): string {
  if (!address) return "Unknown";
  if (address.length <= width * 2 + 2) return address;
  return `${address.slice(0, width + 2)}...${address.slice(-width)}`;
}

export function formatTimeLeft(endTime: string): string {
  const now = Date.now();
  const target = Number(endTime) * 1000;
  const diff = target - now;

  if (Number.isNaN(target)) return "Unknown";
  if (diff <= 0) return "Ended";

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatMon(value?: string | null, decimals = fallbackStableDecimals, symbol = fallbackStableSymbol): string {
  if (!value) return "Hidden";

  const amount = Number(formatUnits(BigInt(value), decimals));
  if (!Number.isFinite(amount)) return `0 ${symbol}`;
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${symbol}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

export function formatDateTime(timestamp?: string | null): string {
  if (!timestamp) return "Unknown";

  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function parseMonAmount(value?: string | null, decimals = fallbackStableDecimals): number {
  if (!value) return 0;
  const amount = Number(formatUnits(BigInt(value), decimals));
  return Number.isFinite(amount) ? amount : 0;
}

export function toVoteChoice(side?: "bull" | "bear" | null): VoteChoice {
  if (side === "bull") return "agree";
  if (side === "bear") return "disagree";
  return null;
}

export function toFeedPost(post: IndexerPost, myVote: VoteChoice = null): FeedPost {
  return {
    id: post.id,
    address: post.creator,
    level: null,
    content: post.content,
    imageUrl: post.imageUrl,
    timeLeft: formatTimeLeft(post.endTime),
    myVote,
    status: post.status,
    winningSide: post.winningSide,
    bullPool: post.bullPool,
    bearPool: post.bearPool,
    bullCount: post.bullCount,
    bearCount: post.bearCount,
    createdAt: post.createdAt,
  };
}
