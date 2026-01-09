#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "$(date): Regenerating GeoJSON..."
node generate-geojson.mjs

if git diff --quiet places.geojson; then
  echo "$(date): No changes to places.geojson"
  exit 0
fi

echo "$(date): Committing and pushing..."
git add places.geojson
git commit -m "Update places $(date +%Y-%m-%d)"
git push

echo "$(date): Done!"
