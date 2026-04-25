"use client";

import Header from "./components/Header";
import DesktopSidebar from "./components/DesktopSidebar";
import PWARegister from "./components/PWARegister";
import { Providers } from "./providers";
import { LiveUpdatesBridge } from "@/lib/live-updates";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <PWARegister />
      <LiveUpdatesBridge />
      <div className="flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:flex-row">
        <DesktopSidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0">
        <Header />
        <main className="flex-1 lg:min-h-0">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
