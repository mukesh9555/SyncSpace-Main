#!/usr/bin/env bash
set -euo pipefail

# Production deployment script for SyncSpace-Lite backend
# Usage: ./deploy.sh [environment]
# Environment: production (default), staging

ENV="${1:-production}"

echo "=== SyncSpace-Lite Deployment: $ENV ==="

# 1. Validate environment
echo "[1/7] Validating environment..."
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and configure for production."
  exit 1
fi

# Source env to check vars
set -a
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ] || [ ${#JWT_SECRET} -lt 32 ]; then
  echo "ERROR: JWT_SECRET must be at least 32 characters"
  exit 1
fi

if [ "${NODE_ENV:-}" != "production" ]; then
  echo "WARNING: NODE_ENV is not 'production' (current: ${NODE_ENV:-unset})"
fi

# 2. Install dependencies
echo "[2/7] Installing dependencies..."
npm ci --omit=dev

# 3. Generate Prisma client
echo "[3/7] Generating Prisma client..."
npx prisma generate

# 4. Validate schema
echo "[4/7] Validating Prisma schema..."
npx prisma validate

# 5. Run migrations (safe — uses migrate deploy, not push)
echo "[5/7] Running database migrations..."
npx prisma migrate deploy

# 6. Build TypeScript
echo "[6/7] Building TypeScript..."
npm run build

# 7. Health check
echo "[7/7] Deployment complete!"
echo ""
echo "To start the server: npm run start"
echo "Or with Docker: docker compose up -d"
