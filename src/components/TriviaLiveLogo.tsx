type Props = {
  className?: string;
  /** Overall height; width scales with the wordmark */
  size?: "sm" | "md" | "lg" | "hero";
  /** Accessible name */
  title?: string;
};

const heights = {
  sm: 32,
  md: 40,
  lg: 56,
  hero: 148,
} as const;

/** Built-in Trivia Live mark: amber bulb + stacked TRIVIA / LIVE wordmark. */
export function TriviaLiveLogo({
  className = "",
  size = "md",
  title = "Trivia Live",
}: Props) {
  const h = heights[size];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/trivia-live-logo.png"
      alt={title}
      height={h}
      className={`select-none ${className}`}
      style={{
        height: h,
        width: "auto",
      }}
      draggable={false}
    />
  );
}
