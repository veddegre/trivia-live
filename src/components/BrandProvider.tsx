"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { BrandConfig } from "@/lib/branding";
import { tokensToCssVars } from "@/lib/branding";

const BrandContext = createContext<BrandConfig | null>(null);

export function useBrand(): BrandConfig | null {
  return useContext(BrandContext);
}

export function useBrandOrFallback(): BrandConfig {
  const brand = useContext(BrandContext);
  if (brand) return brand;
  return {
    displayName: "Trivia Live",
    tagline: null,
    logoUrl: null,
    preset: "default",
    mode: "dark",
    accent: null,
    background: null,
    tokens: {
      ink: "#070b14",
      ink2: "#0e1524",
      panel: "#141c2e",
      line: "#2a3550",
      chalk: "#f4f0e6",
      muted: "#9aa6c1",
      amber: "#f0a820",
      amberHot: "#ffc14d",
    },
  };
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
  const active = brand ?? parent;

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
    if (brand?.mode) root.dataset.brandMode = brand.mode;
    return () => {
      for (const [key, value] of Object.entries(prev)) {
        if (value) root.style.setProperty(key, value);
        else root.style.removeProperty(key);
      }
    };
  }, [applyToDocument, brand?.mode, cssVars]);

  return (
    <BrandContext.Provider value={active}>
      <div className={className ?? "min-h-screen"} data-brand-mode={active?.mode ?? "dark"}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
