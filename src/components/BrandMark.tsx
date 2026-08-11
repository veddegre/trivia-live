"use client";

import Link from "next/link";
import { TriviaLiveLogo } from "./TriviaLiveLogo";
import { useBrandOrFallback } from "./BrandProvider";

type Props = {
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "hero";
  /** @deprecated Kept for call-site compat; default mark replaces the LIVE pill. */
  badgeLast?: boolean;
};

const sizeClass = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl md:text-4xl",
  hero: "text-5xl md:text-7xl",
};

const logoSize = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  hero: "h-16 w-16",
};

function SplitName({
  name,
  size,
}: {
  name: string;
  size: keyof typeof sizeClass;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return <span className={`display text-chalk ${sizeClass[size]}`}>{name}</span>;
  }
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(" ");
  return (
    <span className={`display inline-flex flex-wrap items-center gap-x-2 ${sizeClass[size]}`}>
      <span className="text-chalk">{rest}</span>
      <span className="text-amber">{last}</span>
    </span>
  );
}

function isDefaultTriviaLive(name: string) {
  return /^trivia\s+live$/i.test(name.trim());
}

export function BrandMark({
  href = "/",
  className = "",
  size = "md",
  badgeLast: _badgeLast = false,
}: Props) {
  const brand = useBrandOrFallback();
  const useBuiltinMark = !brand.logoUrl && isDefaultTriviaLive(brand.displayName);

  const inner = useBuiltinMark ? (
    <TriviaLiveLogo size={size === "hero" ? "hero" : size} className={className} />
  ) : (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt=""
          className={`${logoSize[size === "hero" ? "lg" : size]} rounded object-contain`}
        />
      ) : null}
      <SplitName name={brand.displayName} size={size === "hero" ? "lg" : size} />
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
