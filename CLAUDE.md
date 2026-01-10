# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portland Places Map is a static web application that displays an interactive map of Portland places (restaurants, bars, coffee shops, bookstores, etc.) synced from an Obsidian vault at `~/Brain/Portland Places/`.

**Live site**: https://hansef.github.io/portland-places-map/

## Commands

```bash
# Run tests
npm test

# Run local dev server (port 4747)
npm run serve

# Regenerate GeoJSON from Obsidian vault
npm run generate

# Full sync (pull, regenerate, commit, push)
./sync.sh
```

## Architecture

### Data Flow
1. Markdown files with YAML frontmatter in `~/Brain/Portland Places/{Category}/` subdirectories
2. `generate-geojson.mjs` parses frontmatter and fetches coordinates via `goplaces` CLI
3. Coordinates cached in `.coord-cache.json` to avoid repeated API calls
4. Output written to `places.geojson`
5. Web app loads GeoJSON and renders with Leaflet.js + Alpine.js

### Frontend Architecture
- **Alpine.js Store** (`index.html`) - Centralized reactive state for filters, UI, and places data
- **app.js** - ES module containing:
  - Pure, exported functions (testable): `slugify`, `filterPlaces`, `encodeFilterHash`, `decodeFilterHash`, etc.
  - `MapApp` class for Leaflet map initialization and marker management
  - Configuration objects: `categoryIcons`, `primaryIcons`, `statusColors`
- **styles.css** - All CSS with CSS custom properties for theming

### Key Files
| File | Purpose |
|------|---------|
| `index.html` | HTML structure + Alpine.js store definition |
| `app.js` | Map logic, pure utility functions, MapApp class |
| `styles.css` | All styles with CSS variables |
| `places.geojson` | Generated GeoJSON FeatureCollection |
| `generate-geojson.mjs` | Node.js data pipeline |
| `serve.mjs` | Zero-dependency local dev server |
| `sync.sh` | Automated sync script |
| `tests/app.test.js` | Unit tests for pure functions |
| `tests/integration.test.js` | Static analysis tests for HTML/CSS/JS integration |
| `.github/workflows/ci.yml` | CI: runs tests, deploys to GitHub Pages |

## Testing

Two test suites run with `npm test`:

### Unit Tests (`tests/app.test.js`)
Tests pure functions in `app.js`:
- `slugify` - URL slug generation
- `filterPlaces` - Place filtering logic
- `encodeFilterHash` / `decodeFilterHash` - URL hash serialization
- `formatWebsiteDisplay` - Social media URL formatting
- `getPlaceIcon` - Icon selection logic

### Integration Tests (`tests/integration.test.js`)
Static analysis to catch common issues without a browser:
- **HTML structure** - Required elements, duplicate IDs, accessibility
- **Assets & dependencies** - File references, HTTPS, trusted CDNs
- **Alpine.js integration** - Plugin order, store registration, directive usage
- **CSS/Alpine conflicts** - Detects `display:none` on `x-show` elements
- **JavaScript quality** - No console.log, debugger, loose equality, deprecated APIs
- **Data validation** - GeoJSON structure and required properties

```bash
npm test              # Run all tests (unit + integration)
npm run test:unit     # Run only unit tests
npm run test:integration  # Run only integration tests
```

## Place Frontmatter Schema

```yaml
---
name: "Place Name"
place_id: "google_place_id"      # Used by goplaces CLI for coordinates
status: "haunts" | "queue"       # haunts=favorite, queue=want to try
category: "Category Name"
primary: "coffee" | "bar" | "restaurant"  # Food & Drink subcategory only
neighborhood: "Neighborhood Name"
address: "Street Address"
website: "https://..."
type: [array]
cuisine: [array]
good-for: [array]
hours: [array]                   # e.g., ["Monday: 9am-5pm", ...]
notes: "Any notes"
---
```

## URL Hash Routing

The app supports deep-linking via URL hash:
- `#place/powells-books` - Direct link to a place
- `#haunts` - Filter by status
- `#all/food-drink` - Filter by category
- `#haunts/food-drink/coffee` - Combined filters

## Status Colors (Warm Palette)

| Status | Color | Hex |
|--------|-------|-----|
| Haunts (favorites) | Green | `#4a7c59` |
| Queue (want to try) | Blue | `#6b8cae` |
| Unknown | Gray | `#9ca3a3` |

## Categories

Food & Drink, Record Shops, Bookstores, Provisions, Clothing, Movie Theaters, Music Venues, Arts & Culture, Supplies

## External Dependencies (CDN)

- **Leaflet.js** (v1.9.4) - Map library
- **Leaflet.markercluster** (v1.5.3) - Marker clustering
- **Alpine.js** (v3.14.3) - Reactive state management
- **Alpine Collapse** (v3.14.3) - Collapse animations
- **Font Awesome** (v6.5.1) - Category icons
- **Google Fonts** - Fraunces + Source Sans 3

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Runs tests on push/PR to main
2. On main branch push: deploys to GitHub Pages after tests pass

## Code Style Notes

- No build step - all JS/CSS loaded directly
- ES modules used throughout (`type: "module"` in package.json)
- Alpine.js for declarative UI bindings, vanilla JS for map logic
- CSS custom properties for consistent theming
