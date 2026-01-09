# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portland Places Map is a static web application that displays an interactive map of Portland places (restaurants, bars, coffee shops, bookstores, etc.) synced from an Obsidian vault at `~/Brain/Portland Places/`.

**Live site**: https://hansef.github.io/portland-places-map/

## Commands

```bash
# Run local dev server (port 4747)
node serve.mjs

# Regenerate GeoJSON from Obsidian vault
node generate-geojson.mjs

# Full sync (pull, regenerate, commit, push)
./sync.sh
```

No build tools, linters, or test frameworks are configured.

## Architecture

**Data Flow:**
1. Markdown files with YAML frontmatter in `~/Brain/Portland Places/{Category}/` subdirectories
2. `generate-geojson.mjs` parses frontmatter and fetches coordinates via `goplaces` CLI
3. Coordinates cached in `.coord-cache.json` to avoid repeated API calls
4. Output written to `places.geojson`
5. `index.html` renders the map using Leaflet.js (loaded via CDN)

**Key Files:**
- `index.html` - Single-file web app (vanilla JS + Leaflet.js)
- `generate-geojson.mjs` - Node.js ES module data pipeline
- `serve.mjs` - Zero-dependency local dev server (port 4747)
- `sync.sh` - Bash script for automated syncing
- `places.geojson` - Generated GeoJSON FeatureCollection

## Place Frontmatter Schema

```yaml
---
name: "Place Name"
place_id: "google_place_id"      # Used by goplaces CLI for coordinates
status: "haunts" | "queue"       # haunts=favorite, queue=want to try
category: "Category Name"
primary: "coffee" | "bar" | "restaurant"  # Food & Drink subcategory
neighborhood: "Neighborhood Name"
address: "Street Address"
type: [array]
cuisine: [array]
good-for: [array]
hours: [array]
notes: "Any notes"
---
```

## Status Colors

- Green (#10b981) = "haunts" (favorite places)
- Blue (#3b82f6) = "queue" (want to try)
- Gray (#9ca3af) = "unknown"

## Categories

Food & Drink, Record Shops, Bookstores, Provisions, Clothing, Movie Theaters, Music Venues, Arts & Culture, Supplies

## External Dependencies

- **Leaflet.js** (v1.9.4) - Map library, loaded via CDN
- **Font Awesome** (v6.5.1) - Category icons, loaded via CDN
- **goplaces CLI** - External tool for fetching coordinates from Google Places API
