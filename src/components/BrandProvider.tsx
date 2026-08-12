"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { BrandConfig } from "@/lib/branding";
import { resolveBrand, tokensToCssVars } from "@/lib/branding";

const BrandContext = createContext<BrandConfig | null>(null);

export function useBrand(): BrandConfig | null {
  return useContext(BrandContext);
}

export function useBrandOrFallback(): BrandConfig {
  return useContext(BrandContext) ?? resolveBrand();
}

type Props = {
  brand: BrandConfig | null;
  children: ReactNode;
  className?: string;
  /** When true (default), push tokens onto documentElement so Tailwind colors update. */
  applyToDocument?: boolean;
};

export function BrandProvider({
  brand,
  children,
  className,
  applyToDocument = true,
}: Props) {
  const parent = useContext(BrandContext);
  const active = brand ?? parent ?? resolveBrand();

  const cssVars = useMemo(
    () => (brand ? tokensToCssVars(brand.tokens) : null),
    [brand]
  );

  useEffect(() => {
    if (!applyToDocument || !cssVars) return;
    const root = document.documentElement;
    const prev: Record<string, string> = {};
    for (const [key, value] of Object.entries(cssVars)) {
      prev[key] = root.style.getPropertyValue(key);
      root.style.setProperty(key, value);
    }
    root.dataset.brandMode = active.mode;
    return () => {
      for (const [key, value] of Object.entries(prev)) {
        if (value) root.style.setProperty(key, value);
        else root.style.removeProperty(key);
      }
    };
  }, [applyToDocument, active.mode, cssVars]);

  return (
    <BrandContext.Provider value={active}>
      <div className={className ?? "min-h-screen"} data-brand-mode={active.mode}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
