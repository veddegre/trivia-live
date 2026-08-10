export const BRAND_PRESETS = ["default", "ocean", "forest", "sunset", "slate"] as const;
export const BRAND_MODES = ["dark", "light"] as const;

export type BrandPresetId = (typeof BRAND_PRESETS)[number];
export type BrandModeId = (typeof BRAND_MODES)[number];

export type SiteBrandFields = {
  displayName: string;
  tagline: string | null;
  logoUrl: string | null;
  preset: BrandPresetId | string;
  mode: BrandModeId | string;
  accent: string | null;
  background: string | null;
};

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
  preset: BrandPresetId;
  mode: BrandModeId;
  accent: string | null;
  background: string | null;
  tokens: BrandTokens;
};

export type BrandOverrides = {
  brandDisplayName?: string | null;
  brandTagline?: string | null;
  brandLogoUrl?: string | null;
  brandPreset?: BrandPresetId | null;
  brandMode?: BrandModeId | null;
  brandAccent?: string | null;
  brandBackground?: string | null;
};

export type SiteBrandInput = {
  displayName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  preset: BrandPresetId;
  mode: BrandModeId;
  accent?: string | null;
  background?: string | null;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: string | null | undefined): boolean {
  if (value == null || value === "") return true;
  return HEX.test(value);
}

function expandHex(hex: string): string {
  const h = hex.slice(1);
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return `#${h.toLowerCase()}`;
}

function mix(a: string, b: string, t: number): string {
  const pa = expandHex(a).slice(1);
  const pb = expandHex(b).slice(1);
  const ch = (i: number) => {
    const av = parseInt(pa.slice(i, i + 2), 16);
    const bv = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(av + (bv - av) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

function lighten(hex: string, t: number): string {
  return mix(hex, "#ffffff", t);
}

function darken(hex: string, t: number): string {
  return mix(hex, "#000000", t);
}

type PresetBase = {
  dark: BrandTokens;
  light: BrandTokens;
};

const PRESETS: Record<BrandPresetId, PresetBase> = {
  default: {
    dark: {
      ink: "#0b1020",
      ink2: "#141b2f",
      panel: "#1a2338",
      line: "#2a3550",
      chalk: "#f4f0e6",
      muted: "#9aa6c1",
      amber: "#e8a317",
      amberHot: "#ffc14d",
    },
    light: {
      ink: "#f4f0e6",
      ink2: "#ebe6d8",
      panel: "#ffffff",
      line: "#d4cfc0",
      chalk: "#141b2f",
      muted: "#5c667a",
      amber: "#c4840a",
      amberHot: "#e8a317",
    },
  },
  ocean: {
    dark: {
      ink: "#061520",
      ink2: "#0c2436",
      panel: "#123047",
      line: "#1e4a66",
      chalk: "#e8f4fa",
      muted: "#8aadc0",
      amber: "#2ec4e8",
      amberHot: "#6edaf5",
    },
    light: {
      ink: "#e8f4fa",
      ink2: "#d5ebf5",
      panel: "#ffffff",
      line: "#b7d4e4",
      chalk: "#0c2436",
      muted: "#4a6f84",
      amber: "#0a8fb0",
      amberHot: "#2ec4e8",
    },
  },
  forest: {
    dark: {
      ink: "#0a1610",
      ink2: "#14261c",
      panel: "#1a3226",
      line: "#2a4a38",
      chalk: "#eaf5ec",
      muted: "#8fad96",
      amber: "#6bcf63",
      amberHot: "#95e38e",
    },
    light: {
      ink: "#eaf5ec",
      ink2: "#d8ebd9",
      panel: "#ffffff",
      line: "#b8d0bb",
      chalk: "#14261c",
      muted: "#4f6e56",
      amber: "#3a9e34",
      amberHot: "#6bcf63",
    },
  },
  sunset: {
    dark: {
      ink: "#1a0e18",
      ink2: "#2a1628",
      panel: "#352034",
      line: "#4e3050",
      chalk: "#f8ecef",
      muted: "#b89aa8",
      amber: "#ff6b6b",
      amberHot: "#ff9a8b",
    },
    light: {
      ink: "#f8ecef",
      ink2: "#f0dde3",
      panel: "#ffffff",
      line: "#e0c4cd",
      chalk: "#2a1628",
      muted: "#7a5a68",
      amber: "#d64545",
      amberHot: "#ff6b6b",
    },
  },
  slate: {
    dark: {
      ink: "#111318",
      ink2: "#1a1d24",
      panel: "#22262f",
      line: "#343a46",
      chalk: "#eef0f4",
      muted: "#9aa1ad",
      amber: "#6b8cff",
      amberHot: "#9ab0ff",
    },
    light: {
      ink: "#eef0f4",
      ink2: "#e2e5eb",
      panel: "#ffffff",
      line: "#c8cdd6",
      chalk: "#1a1d24",
      muted: "#5c6370",
      amber: "#3d5fd9",
      amberHot: "#6b8cff",
    },
  },
};

export function buildTokens(
  preset: BrandPresetId,
  mode: BrandModeId,
  accent?: string | null,
  background?: string | null
): BrandTokens {
  const base = { ...PRESETS[preset][mode] };
  if (background && isValidHex(background) && background) {
    const bg = expandHex(background);
    base.ink = bg;
    base.ink2 = mode === "dark" ? lighten(bg, 0.08) : darken(bg, 0.06);
    base.panel = mode === "dark" ? lighten(bg, 0.12) : lighten(bg, 0.55);
    base.line = mode === "dark" ? lighten(bg, 0.22) : darken(bg, 0.18);
  }
  if (accent && isValidHex(accent) && accent) {
    const ac = expandHex(accent);
    base.amber = ac;
    base.amberHot = lighten(ac, 0.22);
  }
  return base;
}

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
    // Tailwind @theme maps — set explicitly so nested overrides win
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

export function resolveBrand(
  site: SiteBrandFields,
  game?: BrandOverrides | null
): BrandConfig {
  const preset = (game?.brandPreset ?? site.preset) as BrandPresetId;
  const mode = (game?.brandMode ?? site.mode) as BrandModeId;
  const accent = game?.brandAccent !== undefined && game?.brandAccent !== null
    ? game.brandAccent
    : site.accent;
  const background =
    game?.brandBackground !== undefined && game?.brandBackground !== null
      ? game.brandBackground
      : site.background;

  // Empty string override means "clear custom color → inherit site/preset"
  const resolvedAccent =
    game && "brandAccent" in game && game.brandAccent === ""
      ? site.accent
      : accent === ""
        ? null
        : accent;
  const resolvedBackground =
    game && "brandBackground" in game && game.brandBackground === ""
      ? site.background
      : background === ""
        ? null
        : background;

  const displayName =
    (game?.brandDisplayName && game.brandDisplayName.trim()) || site.displayName;
  const tagline =
    game?.brandTagline !== undefined && game?.brandTagline !== null
      ? game.brandTagline.trim() || null
      : site.tagline;
  const logoUrl =
    game?.brandLogoUrl !== undefined && game?.brandLogoUrl !== null
      ? game.brandLogoUrl.trim() || null
      : site.logoUrl;

  return {
    displayName,
    tagline,
    logoUrl,
    preset,
    mode,
    accent: resolvedAccent ?? null,
    background: resolvedBackground ?? null,
    tokens: buildTokens(preset, mode, resolvedAccent, resolvedBackground),
  };
}

const DEFAULT_SITE: SiteBrandInput = {
  displayName: "Trivia Live",
  tagline: null,
  logoUrl: null,
  preset: "default",
  mode: "dark",
  accent: null,
  background: null,
};

export function siteToConfig(site: SiteBrandFields): BrandConfig {
  return resolveBrand(site);
}

export function brandOverridesFromInput(input: {
  brandDisplayName?: string | null;
  brandTagline?: string | null;
  brandLogoUrl?: string | null;
  brandPreset?: BrandPresetId | null;
  brandMode?: BrandModeId | null;
  brandAccent?: string | null;
  brandBackground?: string | null;
  customize?: boolean;
}): BrandOverrides {
  if (input.customize === false) {
    return {
      brandDisplayName: null,
      brandTagline: null,
      brandLogoUrl: null,
      brandPreset: null,
      brandMode: null,
      brandAccent: null,
      brandBackground: null,
    };
  }
  const preset =
    input.brandPreset && (BRAND_PRESETS as readonly string[]).includes(input.brandPreset)
      ? input.brandPreset
      : null;
  const mode =
    input.brandMode && (BRAND_MODES as readonly string[]).includes(input.brandMode)
      ? input.brandMode
      : null;
  return {
    brandDisplayName: emptyToNull(input.brandDisplayName),
    brandTagline: emptyToNull(input.brandTagline),
    brandLogoUrl: emptyToNull(input.brandLogoUrl),
    brandPreset: preset,
    brandMode: mode,
    brandAccent: emptyToNull(input.brandAccent),
    brandBackground: emptyToNull(input.brandBackground),
  };
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

export { DEFAULT_SITE };
