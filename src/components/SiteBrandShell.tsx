"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { BrandConfig } from "@/lib/branding";
import { BrandProvider } from "./BrandProvider";

export function SiteBrandShell({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/branding");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.brand) setBrand(data.brand as BrandConfig);
      } catch {
        /* keep defaults from CSS */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!brand) return;
    document.title = brand.displayName;
  }, [brand]);

  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
