#!/bin/sh
# Dump Postgres and the uploads volume into ./backups/<stamp>/ on the host.
set -eu
cd "$(dirname "$0")/.."
docker compose --profile tools run --rm backup
