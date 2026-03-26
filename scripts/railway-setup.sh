#!/usr/bin/env bash
# Railway setup script for token-research-pipeline
# Run this once from your local machine after cloning the repo.
#
# Prerequisites:
#   npm install -g @railway/cli
#
# Usage:
#   ./scripts/railway-setup.sh
#
# You will be prompted to log in via browser on first run.
# To use a token instead: railway login --token YOUR_TOKEN

set -euo pipefail

echo ""
echo "=== Token Research Pipeline — Railway Setup ==="
echo ""

# ─── 1. Login ───────────────────────────────────────────────────────

echo "Step 1: Logging in to Railway..."
railway login

# ─── 2. Link or init project ────────────────────────────────────────

echo ""
echo "Step 2: Link to a Railway project."
echo "  - To use your existing Jinn project: choose it from the list."
echo "  - To create a new project: select 'Create new project'."
echo ""
railway link

# ─── 3. Add Postgres ────────────────────────────────────────────────

echo ""
echo "Step 3: Adding Postgres database..."
railway add --plugin postgresql
echo "Postgres added. DATABASE_URL will be injected automatically."

# ─── 4. Push schema ─────────────────────────────────────────────────

echo ""
echo "Step 4: Pushing Drizzle schema to database..."
# Pull DATABASE_URL from Railway into local shell for drizzle-kit
eval "$(railway variables --json | node -e "
  const v = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (v.DATABASE_URL) process.stdout.write('export DATABASE_URL=' + JSON.stringify(v.DATABASE_URL) + '\n');
")"
npx drizzle-kit push
echo "Schema pushed."

# ─── 5. Create daily-ingest service ─────────────────────────────────

echo ""
echo "Step 5: Creating daily-ingest cron service..."
railway service create daily-ingest
railway service daily-ingest variables set RAILWAY_START_CMD=src/daily.ts
echo ""
echo "  ACTION REQUIRED: Open Railway dashboard and set the cron schedule"
echo "  for 'daily-ingest' to:  0 6 * * *  (6am UTC, every day)"
echo ""
read -p "Press Enter once you've set the cron schedule in the dashboard..."

# ─── 6. Create weekly-scoring service ───────────────────────────────

echo ""
echo "Step 6: Creating weekly-scoring cron service..."
railway service create weekly-scoring
railway service weekly-scoring variables set RAILWAY_START_CMD=src/weekly.ts
echo ""
echo "  ACTION REQUIRED: Open Railway dashboard and set the cron schedule"
echo "  for 'weekly-scoring' to:  0 8 * * 1  (8am UTC, every Monday)"
echo ""
read -p "Press Enter once you've set the cron schedule in the dashboard..."

# ─── 7. Deploy ──────────────────────────────────────────────────────

echo ""
echo "Step 7: Deploying..."
railway up --detach
echo "Deployment triggered."

# ─── Done ───────────────────────────────────────────────────────────

echo ""
echo "=== Setup complete ==="
echo ""
echo "Services:"
echo "  daily-ingest   — runs daily at 06:00 UTC"
echo "  weekly-scoring — runs every Monday at 08:00 UTC"
echo ""
echo "To check logs:   railway logs --service daily-ingest"
echo "To run manually: railway run --service daily-ingest npx tsx src/daily.ts"
echo ""
