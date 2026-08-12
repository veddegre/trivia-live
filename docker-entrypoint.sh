#!/bin/sh
set -e
echo "Applying database schema..."
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null | grep -v migration_lock.toml)" ]; then
  if ! npx prisma migrate deploy; then
    echo "WARNING: prisma migrate deploy failed — falling back to db push"
    npx prisma db push --skip-generate
  fi
else
  npx prisma db push --skip-generate
fi
echo "Optional super-admin bootstrap (SUPERADMIN_BOOTSTRAP=1)..."
npx tsx scripts/seed-superadmin.ts || true
echo "Starting Trivia Live..."
exec npx tsx server/index.ts
