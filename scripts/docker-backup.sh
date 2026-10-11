#!/bin/sh
# Runs inside the backup container. Writes a Postgres custom dump and an
# uploads archive under /backups/<utc-stamp>/.
set -eu

stamp=$(date -u +%Y%m%dT%H%M%SZ)
dir="/backups/${stamp}"
mkdir -p "$dir"

pg_dump --no-owner --format=custom --file="$dir/trivia.pgdump"
tar czf "$dir/uploads.tgz" -C /uploads .

printf '%s\n' "{\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"backup written\",\"dir\":\"${dir}\"}"
