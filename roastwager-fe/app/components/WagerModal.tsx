"use client";

import { useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { BaseError, maxUint256, parseUnits } from "viem";
import { roastWagerAbi } from "@/lib/roastWagerAbi";
import { requireRoastWagerAddress } from "@/lib/contracts";
import { refreshRoastWagerQueries } from "@/lib/query-sync";
import { useStakeToken } from "@/lib/useStakeToken";
import { useOptimisticRoastWager } from "@/lib/optimistic-roastwager";
import { fetchUser } from "@/lib/backend";
import { useBetPreferences } from "@/lib/bet-preferences";
import { erc20Abi } from "@/lib/erc20Abi";
import { getLevelStakeCap } from "@/lib/leveling";

type Props = {
  open: boolean;
  type: "agree" | "disagree" | null;
  onClose: () => void;
  content: string;
  postId: string;
  initialAmount: string;
};

export default function WagerModal({ open, type, onClose, content, postId, initialAmount }: Props) {
  const { defaultAmount } = useBetPreferences();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const roastWagerAddress = requireRoastWagerAddress();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { tokenAddress, symbol, decimals, minBet, voteMode } = useStakeToken();
  const { addOptimisticVote, removeOptimisticVote } = useOptimisticRoastWager();
  const { writeContractAsync, isPending } = useWriteContract();
  const userQuery = useQuery({
    queryKey: ["wager-user", address],
    queryFn: () => fetchUser(address!),
    enabled: Boolean(address),
    staleTime: 5000,
  });
  const balanceAndAllowanceQuery = useReadContracts({
    allowFailure: true,
    contracts:
      tokenAddress && address
        ? [
            { address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address] },
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address, roastWagerAddress],
            },
          ]
        : [],
    query: {
      enabled: Boolean(tokenAddress && address && voteMode === "erc20"),
      refetchInterval: 4000,
    },
  });

  const sideLabel = useMemo(() => (type === "agree" ? "Agree" : "Nah"), [type]);
  const balance = (balanceAndAllowanceQuery.data?.[0]?.result as bigint | undefined) ?? BigInt(0);
  const allowance = (balanceAndAllowanceQuery.data?.[1]?.result as bigint | undefined) ?? BigInt(0);
  const level = userQuery.data?.level ?? 1;
  const levelCap = getLevelStakeCap(level);
  const configuredAmount = initialAmount || defaultAmount;

  if (!open || !type) return null;

  const handleClose = () => {
    setStatus("");
    setError("");
    onClose();
  };

  const handleConfirm = async () => {
    if (!isConnected || !address) {
      setError("Connect your wallet first.");
      return;
    }
    if (!publicClient) {
      setError("Public client is not ready.");
      return;
    }

    let amountValue: bigint;
    try {
      amountValue = parseUnits(configuredAmount || "0", decimals);
    } catch {
      setError("Set your default bet amount from profile first.");
      return;
    }

    if (amountValue <= BigInt(0)) {
      setError("Set your default bet amount from profile first.");
      return;
    }
    if (minBet && amountValue < minBet) {
      setError(`Minimum bet is ${(Number(minBet) / 10 ** decimals).toFixed(3)} ${symbol}.`);
      return;
    }
    if (voteMode === "erc20" && !tokenAddress) {
      setError("NEXT_PUBLIC_STABLE_TOKEN_ADDRESS belum diset.");
      return;
    }
    if (amountValue > balance && voteMode === "erc20") {
      setError(`Insufficient ${symbol} balance.`);
      return;
    }
    const maxByLevel = parseUnits(String(levelCap), decimals);
    if (amountValue > maxByLevel) {
      setError(`Level ${level} max bet is ${levelCap} ${symbol}. Update it in Profile.`);
      return;
    }

    let optimisticApplied = false;

    try {
      setError("");
      setStatus("Submitting wager...");
      if (voteMode === "erc20") {
        if (!tokenAddress) throw new Error("Stable token address is not configured");
        if (allowance < amountValue) {
          setStatus(`Approving ${symbol}...`);
          const approveHash = await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [roastWagerAddress, maxUint256],
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
          if (approveReceipt.status !== "success") {
            throw new Error("Approve transaction reverted");
          }
        }
      }

      const hash = await writeContractAsync(
        voteMode === "erc20"
          ? {
              address: roastWagerAddress,
              abi: roastWagerAbi,
              functionName: "vote",
              args: [BigInt(postId), type === "agree", amountValue],
            }
          : {
              address: roastWagerAddress,
              abi: roastWagerAbi,
              functionName: "vote",
              args: [BigInt(postId), type === "agree"],
              value: amountValue,
            },
      );

      addOptimisticVote(postId, type);
      optimisticApplied = true;

      setStatus("Transaction submitted. Waiting for confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Vote transaction reverted");
      }

      setStatus("Confirmed. Waiting for backend sync...");
      await refreshRoastWagerQueries(queryClient, address);
      handleClose();
    } catch (voteError) {
      if (optimisticApplied) {
        removeOptimisticVote(postId);
      }

      const message =
        voteError instanceof BaseError
          ? voteError.shortMessage || voteError.message
          : voteError instanceof Error
            ? voteError.message
            : "Failed to place wager";
      setError(message);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-[var(--text-main)]">Confirm Wager</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 line-clamp-3 text-xs text-[var(--text-muted)]">{content}</p>

        <div className="mb-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)]">Wager</span>
            <span className="font-bold text-[var(--text-main)]">
              {configuredAmount} {symbol}
            </span>
          </div>
        </div>

        <div className="mb-4 text-xs text-[var(--text-muted)]">
          Level {level} • Max {levelCap} {symbol} • Balance {tokenAddress ? `${(Number(balance) / 10 ** decimals).toFixed(3)} ${symbol}` : "N/A"}
        </div>

        <button
          onClick={handleConfirm}
          disabled={isPending}
          className={`w-full rounded-xl py-3 text-sm font-bold transition active:scale-95 ${
            type === "agree"
              ? "bg-[var(--primary-soft)] text-white"
              : "bg-[var(--border-soft)] text-gray-300 hover:bg-[#2a2a35]"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {type === "agree" ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
            {isPending ? "Pending..." : `${sideLabel} · ${configuredAmount} ${symbol}`}
          </span>
        </button>

        {(status || error) && (
          <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3 text-sm">
            {status && <p className="text-[var(--text-main)]">{status}</p>}
            {error && <p className="text-red-300">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
