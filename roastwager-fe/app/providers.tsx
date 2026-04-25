"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  darkTheme,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { cookieStorage, createStorage, WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { monadTestnet } from "wagmi/chains";
import { useMemo } from "react";
import { OptimisticRoastWagerProvider } from "@/lib/optimistic-roastwager";
import { BetPreferencesProvider } from "@/lib/bet-preferences";

const config = getDefaultConfig({
  appName: "RoastWager",
  projectId: "ddfa2b83de6e2b1a74be3c0341ea060c",
  chains: [monadTestnet],
  ssr: false,
  storage: createStorage({
    storage: cookieStorage,
  }),
});

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 10,
          },
        },
      }),
    [],
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <OptimisticRoastWagerProvider>
            <BetPreferencesProvider>{children}</BetPreferencesProvider>
          </OptimisticRoastWagerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
