"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Compass, Home, User } from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { fetchUser, fetchWagersByUser, getBackendApiUrl } from "@/lib/backend";
import { formatMon, formatPercent } from "@/lib/format";
import { useStakeToken } from "@/lib/useStakeToken";
import Image from "next/image";


const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/profile", label: "Profile", icon: User },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { tokenAddress, symbol, decimals } = useStakeToken();
  const userQuery = useQuery({
    queryKey: ["desktop-user", address],
    queryFn: () => fetchUser(address!),
    enabled: Boolean(address),
    refetchInterval: 5000,
  });
  const wagersQuery = useQuery({
    queryKey: ["desktop-wagers", address],
    queryFn: () => fetchWagersByUser(address!, 100),
    enabled: Boolean(address),
    refetchInterval: 5000,
  });
  const balanceQuery = useBalance({
    address,
    token: tokenAddress,
    query: { enabled: Boolean(address && tokenAddress) },
  });
  const settledWagers = (wagersQuery.data ?? []).filter((wager) =>
    ["win", "lose", "refund"].includes(wager.result),
  );
  const wins = settledWagers.filter((wager) => wager.result === "win").length;
  const winRate = settledWagers.length === 0 ? 0 : (wins / settledWagers.length) * 100;

  return (
    <aside className="hidden h-screen w-72 flex-col overflow-hidden border-r border-[var(--border-soft)] bg-[var(--bg-card)] p-5 lg:flex">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-black text-white">
          RW
        </div>
        <div>
          <p className="text-base font-black tracking-tight text-[var(--text-main)]">RoastWager</p>
          <p className="text-xs text-[var(--text-muted)]">Monad Market</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-main)] hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {pathname === "/" && (
        <div className="mt-4 space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3 text-sm">
          <div>
            <p className="text-xs text-[var(--primary-soft)]">Wallet</p>
            <p className="font-bold text-[var(--text-main)]">
              {formatMon(balanceQuery.data?.value?.toString(), decimals, symbol)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-[var(--border-soft)] p-2">
              <p className="text-[var(--text-muted)]">Level</p>
              <p className="font-bold text-[var(--text-main)]">{userQuery.data?.level ?? 1}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] p-2">
              <p className="text-[var(--text-muted)]">Win Rate</p>
              <p className="font-bold text-[var(--text-main)]">{formatPercent(winRate)}</p>
            </div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Live feed source: <span className="text-[var(--text-main)]">{getBackendApiUrl()}</span>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3">
        {userQuery.data?.username && (
          <div className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--primary-soft)]">
            @{userQuery.data.username}
          </div>
        )}
        <ConnectButton />
      </div>
    </aside>
  );
}
