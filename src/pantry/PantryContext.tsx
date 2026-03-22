import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_PANTRY_ITEMS } from './defaultPantry';
import { usePantry, type UsePantryResult } from './usePantry';

const PantryContext = createContext<UsePantryResult | null>(null);

/** Single pantry store for PantryScreen, chatbot, and future scanners. */
export function PantryProvider({ children }: { children: ReactNode }) {
  const initialPantry = useMemo(
    () => DEFAULT_PANTRY_ITEMS.map((row) => ({ ...row })),
    []
  );
  const value = usePantry(initialPantry);
  return (
    <PantryContext.Provider value={value}>{children}</PantryContext.Provider>
  );
}

export function usePantryContext(): UsePantryResult {
  const ctx = useContext(PantryContext);
  if (ctx == null) {
    throw new Error('usePantryContext must be used within PantryProvider');
  }
  return ctx;
}
