# Portland Places Map

Interactive map of Portland places synced from an Obsidian vault.

## Live Map

https://hansef.github.io/portland-places-map/

## Features

- Filter by status (Haunts/Queue), category, and Food & Drink type
- Deep-linking via URL hash (e.g., `#haunts/food-drink/coffee`)
- Marker clustering for dense areas
- List sidebar with collapsible categories
- Current location tracking
- Mobile responsive

## How It Works

1. Places are stored as markdown files with YAML frontmatter in `~/Brain/Portland Places/`
2. `generate-geojson.mjs` extracts frontmatter and fetches coordinates via Google Places API
3. Coordinates are cached in `.coord-cache.json` to avoid repeated API calls
4. `places.geojson` is committed and served via GitHub Pages
5. The web app renders the map using Leaflet.js and Alpine.js for state management

## Project Structure

```
├── index.html          # Main HTML with Alpine.js store
├── app.js              # ES module with map logic and pure functions
├── styles.css          # All CSS styles
├── places.geojson      # Generated place data
├── generate-geojson.mjs # Data pipeline script
├── serve.mjs           # Local dev server
├── sync.sh             # Automated sync script
├── tests/
│   └── app.test.js     # Unit tests for pure functions
└── .github/
    └── workflows/
        └── ci.yml      # CI: tests + GitHub Pages deploy
```

## Local Development

```bash
# Install nothing - zero dependencies!

# Run local dev server (port 4747)
npm run serve
# or: node serve.mjs

# Run tests
npm test
# or: node tests/app.test.js
```

## Regenerating Places

```bash
npm run generate
# or: node generate-geojson.mjs
```

Requires the `goplaces` CLI tool to be installed and configured with a Google Places API key.

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
0 8 * * * cd /path/to/portland-places-map && ./sync.sh >> /path/to/sync.log 2>&1
```

## Status Colors

- Green (`#4a7c59`) = Haunts (favorites)
- Blue (`#6b8cae`) = Queue (want to try)
- Gray (`#9ca3a3`) = Unknown

## Tech Stack

- **Leaflet.js** (v1.9.4) - Map rendering
- **Leaflet.markercluster** (v1.5.3) - Marker clustering
- **Alpine.js** (v3.14.3) - Reactive state management
- **Font Awesome** (v6.5.1) - Icons
- **GitHub Pages** - Hosting
- **GitHub Actions** - CI/CD
