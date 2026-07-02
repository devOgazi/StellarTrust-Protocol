#!/usr/bin/env bash
# Run Prisma database migrations.
set -euo pipefail

cd "$(dirname "$0")/../backend"
npx prisma migrate deploy
echo "Migrations applied."
