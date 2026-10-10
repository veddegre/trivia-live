#!/bin/sh
set -e
echo "Applying database schema..."
npx prisma migrate deploy
echo "Checking super-admin bootstrap..."
npx tsx scripts/seed-superadmin.ts || true
echo "Starting Trivia Live..."
exec npx tsx server/index.ts
