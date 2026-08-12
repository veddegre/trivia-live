"use client";

import Link from "next/link";
import { TriviaLiveLogo } from "./TriviaLiveLogo";

type Props = {
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "hero";
  /** @deprecated Kept for call-site compat. */
  badgeLast?: boolean;
};

export function BrandMark({
  href = "/",
  className = "",
  size = "md",
  badgeLast: _badgeLast = false,
}: Props) {
  const inner = (
    <TriviaLiveLogo size={size === "hero" ? "hero" : size} className={className} />
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
