"use client";

import Link from "next/link";
import { useBrandOrFallback } from "./BrandProvider";

type Props = {
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl md:text-4xl",
};

const logoSize = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export function BrandMark({ href = "/", className = "", size = "md" }: Props) {
  const brand = useBrandOrFallback();
  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt=""
          className={`${logoSize[size]} rounded object-contain`}
        />
      ) : null}
      <span className={`display text-amber ${sizeClass[size]}`}>{brand.displayName}</span>
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
