export const roastWagerAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
export const stableTokenAddress = process.env.NEXT_PUBLIC_STABLE_TOKEN_ADDRESS as
  | `0x${string}`
  | undefined;

export function hasRoastWagerAddress() {
  return Boolean(roastWagerAddress);
}

export function requireRoastWagerAddress() {
  if (!roastWagerAddress) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured");
  }

  return roastWagerAddress;
}
