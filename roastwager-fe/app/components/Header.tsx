"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { fetchUser } from "@/lib/backend";
import Image from "next/image";

export default function Header() {
  const { address } = useAccount();
  const userQuery = useQuery({
    queryKey: ["header-user", address],
    queryFn: () => fetchUser(address!),
    enabled: Boolean(address),
    refetchInterval: 5000,
  });

  return (
    <div
      className="w-full h-16 flex items-center justify-between px-4 lg:hidden
    bg-[var(--bg-card)] border-b border-[var(--border-soft)]
    sticky top-0 z-40"
    >
      {/* Left */}
      <div className="flex items-center gap-2">
        <Image
          src="/favicon/favicon-32x32.png"
          alt="RoastWager icon"
          width={28}
          height={28}
          className="h-7 w-7 rounded-lg"
        />

        <span className="text-base font-black text-[var(--text-main)] tracking-tight">
          RoastWager
        </span>
        {userQuery.data?.username && (
          <span className="rounded-full bg-[var(--bg-main)] px-2 py-1 text-[10px] font-semibold text-[var(--primary-soft)]">
            @{userQuery.data.username}
          </span>
        )}
      </div>

      {/* Right
      <button className="bg-[var(--primary)]/10 text-[var(--primary-soft)]
      text-xs font-bold px-4 py-2 rounded-full
      border border-[var(--primary)]/20
      hover:bg-[var(--primary)]/20 transition">
        Connected
      </button> */}

      <ConnectButton />
    </div>
  );
}
