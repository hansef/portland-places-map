# Portland Places Map

Interactive map of Portland places synced from Obsidian vault.

## Live Map

https://hansfriederich.github.io/portland-places-map/

## How It Works

1. Places are stored as markdown files in `~/Brain/Portland Places/`
2. `generate-geojson.mjs` extracts frontmatter and fetches coordinates via Google Places API
3. Coordinates are cached in `.coord-cache.json` to avoid repeated API calls
4. `places.geojson` is committed and served via GitHub Pages
5. `index.html` renders the map with Leaflet

## Regenerating

```bash
node generate-geojson.mjs
```

## Syncing to GitHub

```bash
./sync.sh
```

Or manually:
```bash
node generate-geojson.mjs
git add places.geojson
git commit -m "Update places $(date +%Y-%m-%d)"
git push
```

## Cron Setup

Add to crontab for automatic daily sync:
```bash
0 8 * * * cd ~/.clawdbot/workspace/portland-places-map && ./sync.sh >> ~/.clawdbot/workspace/logs/portland-map-sync.log 2>&1
```

## Status Colors

- 🟡 Gold = Favorite
- 🟢 Green = Tried  
- 🔵 Blue = Want to Try
