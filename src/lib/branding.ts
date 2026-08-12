/** Fixed Trivia Live look — custom / per-game branding was removed. */

export type BrandTokens = {
  ink: string;
  ink2: string;
  panel: string;
  line: string;
  chalk: string;
  muted: string;
  amber: string;
  amberHot: string;
};

export type BrandConfig = {
  displayName: string;
  tagline: string | null;
  logoUrl: string | null;
  mode: "dark";
  tokens: BrandTokens;
};

const TOKENS: BrandTokens = {
  ink: "#070b14",
  ink2: "#0e1524",
  panel: "#141c2e",
  line: "#2a3550",
  chalk: "#f4f0e6",
  muted: "#9aa6c1",
  amber: "#f0a820",
  amberHot: "#ffc14d",
};

export function tokensToCssVars(tokens: BrandTokens): Record<string, string> {
  return {
    "--ink": tokens.ink,
    "--ink-2": tokens.ink2,
    "--panel": tokens.panel,
    "--line": tokens.line,
    "--chalk": tokens.chalk,
    "--muted": tokens.muted,
    "--amber": tokens.amber,
    "--amber-hot": tokens.amberHot,
    "--background": tokens.ink,
    "--foreground": tokens.chalk,
    "--color-ink": tokens.ink,
    "--color-ink-2": tokens.ink2,
    "--color-panel": tokens.panel,
    "--color-line": tokens.line,
    "--color-chalk": tokens.chalk,
    "--color-muted": tokens.muted,
    "--color-amber": tokens.amber,
    "--color-amber-hot": tokens.amberHot,
    "--color-background": tokens.ink,
    "--color-foreground": tokens.chalk,
  };
}

export function resolveBrand(): BrandConfig {
  return {
    displayName: "Trivia Live",
    tagline: null,
    logoUrl: null,
    mode: "dark",
    tokens: TOKENS,
  };
}

export function siteToConfig(): BrandConfig {
  return resolveBrand();
}
