"use client";

import { createContext, useContext, useMemo, useState } from "react";

type BetPreferencesValue = {
  defaultAmount: string;
  setDefaultAmount: (amount: string) => void;
};

const DEFAULT_AMOUNT = "5";
const STORAGE_KEY = "roastwager:default-bet-amount";

const BetPreferencesContext = createContext<BetPreferencesValue | null>(null);

function hasUsableLocalStorage() {
  if (typeof window === "undefined") return false;
  const storage = window.localStorage;
  return (
    storage !== undefined &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function"
  );
}

export function BetPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [defaultAmount, setDefaultAmountState] = useState(() => {
    if (!hasUsableLocalStorage()) return DEFAULT_AMOUNT;
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_AMOUNT;
  });

  const value = useMemo(
    () => ({
      defaultAmount,
      setDefaultAmount: (amount: string) => {
        setDefaultAmountState(amount);
        if (hasUsableLocalStorage()) {
          window.localStorage.setItem(STORAGE_KEY, amount);
        }
      },
    }),
    [defaultAmount],
  );

  return <BetPreferencesContext.Provider value={value}>{children}</BetPreferencesContext.Provider>;
}

export function useBetPreferences() {
  const context = useContext(BetPreferencesContext);
  if (!context) throw new Error("useBetPreferences must be used within BetPreferencesProvider");
  return context;
}
