#!/usr/bin/env bash
# CACI Hub — Setup Script
# Run this after extracting the zip to install deps and seed the database.
set -e
echo "📦 Installing dependencies..."
bun install 2>/dev/null || npm install
echo ""
echo "🗄️  Creating database directory..."
mkdir -p db
echo ""
echo "📋 Pushing Prisma schema..."
bun run db:push 2>/dev/null || npx prisma db push --accept-data-loss
echo ""
echo "🌱 Seeding demo data..."
bun run scripts/seed.ts 2>/dev/null || npx tsx scripts/seed.ts 2>/dev/null || npx bun scripts/seed.ts
echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the dev server:"
echo "  bun run dev    (or: npm run dev)"
echo ""
echo "Then open http://localhost:3000"
echo ""
echo "Demo credentials:"
echo "  Admin:  024 400 0001 / CACI@2026!"
echo "  Member: 024 400 0002 / CACI@2026!"
