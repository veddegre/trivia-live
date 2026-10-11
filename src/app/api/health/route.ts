import { constants } from "fs";
import { access } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { healthBody, log } from "@/lib/log";
import { getUploadDir } from "@/lib/media";

export const dynamic = "force-dynamic";

async function databaseUp(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function uploadsWritable(): Promise<boolean> {
  try {
    await access(getUploadDir(), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks = {
    db: await databaseUp(),
    uploads: await uploadsWritable(),
  };
  const result = healthBody(checks);
  if (!result.body.ok) {
    log.error("health check failed", checks);
  }
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
