import type { SiteBrand } from "@prisma/client";
import { DEFAULT_SITE } from "@/lib/branding";
import { prisma } from "@/lib/db";

export async function getSiteBrand(): Promise<SiteBrand> {
  const existing = await prisma.siteBrand.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.siteBrand.create({
    data: {
      id: "default",
      displayName: DEFAULT_SITE.displayName,
      tagline: DEFAULT_SITE.tagline,
      logoUrl: DEFAULT_SITE.logoUrl,
      preset: DEFAULT_SITE.preset,
      mode: DEFAULT_SITE.mode,
      accent: DEFAULT_SITE.accent,
      background: DEFAULT_SITE.background,
    },
  });
}
