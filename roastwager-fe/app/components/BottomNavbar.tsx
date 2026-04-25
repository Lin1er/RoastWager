"use client";

import { Home, Compass, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 lg:hidden
    bg-[var(--bg-card)] border-t border-[var(--border-soft)]
    flex justify-around py-3 z-50 backdrop-blur-md"
    >
      {/* Home */}
      <Link
        href="/"
        className={`transition ${
          isActive("/")
            ? "text-[var(--primary-soft)] scale-110"
            : "text-[var(--text-muted)] hover:text-white"
        }`}
      >
        <Home size={22} />
      </Link>

      {/* Explore */}
      <Link
        href="/explore"
        className={`transition ${
          isActive("/explore")
            ? "text-[var(--primary-soft)] scale-110"
            : "text-[var(--text-muted)] hover:text-white"
        }`}
      >
        <Compass size={22} />
      </Link>

      {/* Profile */}
      <Link
        href="/profile"
        className={`transition ${
          isActive("/profile")
            ? "text-[var(--primary-soft)] scale-110"
            : "text-[var(--text-muted)] hover:text-white"
        }`}
      >
        <User size={22} />
      </Link>
    </div>
  );
}
