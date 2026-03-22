import { createContext, useContext, type ReactNode } from 'react';
import { usePantry, type UsePantryResult } from './usePantry';

const PantryContext = createContext<UsePantryResult | null>(null);

/** Single pantry store for PantryScreen, chatbot, and future scanners. */
export function PantryProvider({ children }: { children: ReactNode }) {
  const value = usePantry();
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
