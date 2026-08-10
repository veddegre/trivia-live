#!/bin/sh
set -e
echo "Applying database schema..."
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null | grep -v migration_lock.toml)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --skip-generate
fi
echo "Starting Bar Trivia..."
exec npx tsx server/index.ts
