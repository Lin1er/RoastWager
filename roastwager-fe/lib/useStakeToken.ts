"use client";

import { parseUnits } from "viem";
import { stableTokenAddress } from "./contracts";

const fallbackSymbol = process.env.NEXT_PUBLIC_STABLE_SYMBOL?.trim() || "USDC";
const fallbackDecimals = Number(process.env.NEXT_PUBLIC_STABLE_DECIMALS || 6);
const fallbackMinBet = process.env.NEXT_PUBLIC_MIN_BET?.trim() || "0.5";
const defaultVoteMode = (process.env.NEXT_PUBLIC_VOTE_MODE?.trim().toLowerCase() || "erc20") as
  | "erc20"
  | "native";

export function useStakeToken() {
  return {
    tokenAddress: stableTokenAddress,
    symbol: fallbackSymbol,
    decimals: fallbackDecimals,
    minBet: parseUnits(fallbackMinBet, fallbackDecimals),
    minPool: undefined,
    voteMode: defaultVoteMode,
    isLoading: false,
  };
}
