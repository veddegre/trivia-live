import { z } from "zod";
import { BRAND_MODES, BRAND_PRESETS, isValidHex } from "@/lib/branding";

export const brandOverrideSchema = z.object({
  customize: z.boolean().optional(),
  brandDisplayName: z.string().max(80).nullable().optional(),
  brandTagline: z.string().max(200).nullable().optional(),
  brandLogoUrl: z.string().max(500).nullable().optional(),
  brandPreset: z.enum(BRAND_PRESETS).nullable().optional(),
  brandMode: z.enum(BRAND_MODES).nullable().optional(),
  brandAccent: z.string().max(7).nullable().optional(),
  brandBackground: z.string().max(7).nullable().optional(),
});

export function validateBrandColors(data: {
  brandAccent?: string | null;
  brandBackground?: string | null;
  accent?: string | null;
  background?: string | null;
}): string | null {
  for (const key of ["brandAccent", "brandBackground", "accent", "background"] as const) {
    const v = data[key];
    if (v != null && v !== "" && !isValidHex(v)) {
      return `Invalid hex for ${key}`;
    }
  }
  return null;
}
