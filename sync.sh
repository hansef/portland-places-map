#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "$(date): Pulling latest changes..."
git pull --rebase --autostash || {
  echo "$(date): Pull failed, aborting"
  exit 1
}

echo "$(date): Regenerating GeoJSON..."
node generate-geojson.mjs

# Check for meaningful changes (ignore the "generated" timestamp line)
# Get lines that changed (+/-), exclude diff headers (+++/---), exclude the generated timestamp
MEANINGFUL_CHANGES=$(git diff places.geojson | grep -E '^[+-]' | grep -v '^[+-]{3}' | grep -v '"generated":' || true)

if [ -z "$MEANINGFUL_CHANGES" ]; then
  echo "$(date): No meaningful changes (only timestamp updated), reverting"
  git checkout places.geojson
  exit 0
fi

echo "$(date): Committing and pushing..."
git add places.geojson
git commit -m "Update places $(date +%Y-%m-%d)"
git push

echo "$(date): Done!"
