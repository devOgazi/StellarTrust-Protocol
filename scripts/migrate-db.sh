#!/usr/bin/env bash
# scripts/migrate-db.sh
#
# Apply Prisma database migrations.  Runs `prisma migrate deploy` which is
# safe to execute repeatedly — it only applies pending migrations.
#
# Usage (from repo root):
#   ./scripts/migrate-db.sh
#
# The script loads backend/.env for DATABASE_URL if it exists.
# Override by exporting DATABASE_URL before running.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

# Load DATABASE_URL from backend/.env if not already set
if [[ -z "${DATABASE_URL:-}" && -f "$BACKEND_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$BACKEND_DIR/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Either set it in backend/.env or export it before running this script."
  exit 1
fi

echo "==> Running Prisma migrations against: $(echo "$DATABASE_URL" | sed 's|//.*@|//<redacted>@|')"

cd "$BACKEND_DIR"

# Ensure prisma client is generated (no-op if already up to date)
npx prisma generate

# Apply all pending migrations
npx prisma migrate deploy

echo ""
echo "[✓] Migrations applied successfully."
