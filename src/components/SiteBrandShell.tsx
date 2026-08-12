"use client";

import type { ReactNode } from "react";

/** App chrome wrapper — fixed Trivia Live look (no custom branding fetch). */
export function SiteBrandShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
