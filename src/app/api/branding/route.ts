import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  BRAND_MODES,
  BRAND_PRESETS,
  isValidHex,
  siteToConfig,
} from "@/lib/branding";
import { prisma } from "@/lib/db";
import { getSiteBrand } from "@/lib/site-brand";

export async function GET() {
  const site = await getSiteBrand();
  return NextResponse.json({ brand: siteToConfig(site), site });
}

const putSchema = z.object({
  displayName: z.string().min(1).max(80),
  tagline: z.string().max(200).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  preset: z.enum(BRAND_PRESETS),
  mode: z.enum(BRAND_MODES),
  accent: z.string().max(7).nullable().optional(),
  background: z.string().max(7).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (!isValidHex(data.accent ?? null) || !isValidHex(data.background ?? null)) {
    return NextResponse.json({ error: "Invalid hex color" }, { status: 400 });
  }

  const site = await prisma.siteBrand.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      displayName: data.displayName,
      tagline: data.tagline?.trim() || null,
      logoUrl: data.logoUrl?.trim() || null,
      preset: data.preset,
      mode: data.mode,
      accent: data.accent?.trim() || null,
      background: data.background?.trim() || null,
    },
    update: {
      displayName: data.displayName,
      tagline: data.tagline?.trim() || null,
      logoUrl: data.logoUrl?.trim() || null,
      preset: data.preset,
      mode: data.mode,
      accent: data.accent?.trim() || null,
      background: data.background?.trim() || null,
    },
  });

  return NextResponse.json({ brand: siteToConfig(site), site });
}
