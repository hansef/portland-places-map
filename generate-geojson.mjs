#!/usr/bin/env node

/**
 * Generates GeoJSON from Portland Places markdown files.
 * Fetches coordinates from Google Places API using place_id.
 * Caches coordinates in a local file to avoid repeated API calls.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const PLACES_DIR = process.env.PLACES_DIR || join(process.env.HOME, 'Brain/Portland Places');
const OUTPUT_FILE = process.env.OUTPUT_FILE || join(import.meta.dirname, 'places.geojson');
const CACHE_FILE = join(import.meta.dirname, '.coord-cache.json');

// Categories to scan (subdirectories)
const CATEGORIES = [
  'Food & Drink',
  'Record Shops',
  'Bookstores',
  'Provisions',
  'Clothing',
  'Movie Theaters',
  'Music Venues',
  'Arts & Culture',
  'Supplies'
];

// Load coordinate cache
async function loadCache() {
  if (existsSync(CACHE_FILE)) {
    const data = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return {};
}

// Save coordinate cache
async function saveCache(cache) {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Parse YAML frontmatter from markdown
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const yaml = match[1];
  const data = {};
  
  // Simple YAML parser for our use case
  let currentKey = null;
  let inArray = false;
  let arrayItems = [];
  
  for (const line of yaml.split('\n')) {
    // Array item
    if (line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, '').replace(/^["']|["']$/g, '');
      arrayItems.push(value);
      continue;
    }
    
    // If we were building an array, save it
    if (inArray && currentKey) {
      data[currentKey] = arrayItems;
      inArray = false;
      arrayItems = [];
    }
    
    // Key: value or Key: [inline array]
    const kvMatch = line.match(/^(\w[\w-]*?):\s*(.*)/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      currentKey = key;
      
      // Inline array like [foo, bar]
      if (value.startsWith('[') && value.endsWith(']')) {
        data[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else if (value === '' || value === null) {
        // Could be start of multi-line array
        inArray = true;
        arrayItems = [];
      } else {
        data[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }
  
  // Handle trailing array
  if (inArray && currentKey) {
    data[currentKey] = arrayItems;
  }
  
  return data;
}

// Get coordinates for a place_id using goplaces CLI
function getCoordinates(placeId, cache) {
  if (cache[placeId]) {
    return cache[placeId];
  }
  
  try {
    const output = execSync(`goplaces details "${placeId}" --json`, { 
      encoding: 'utf-8',
      timeout: 10000 
    });
    const data = JSON.parse(output);
    if (data.location) {
      const coords = {
        lat: data.location.lat,
        lng: data.location.lng
      };
      cache[placeId] = coords;
      return coords;
    }
  } catch (e) {
    console.error(`Failed to get coords for ${placeId}:`, e.message);
  }
  return null;
}

// Read all places from a category directory
async function readCategory(category) {
  const dir = join(PLACES_DIR, category);
  if (!existsSync(dir)) return [];
  
  const files = await readdir(dir);
  const places = [];
  
  for (const file of files) {
    if (!file.endsWith('.md') || file.startsWith('_') || file.startsWith('-')) continue;
    
    const content = await readFile(join(dir, file), 'utf-8');
    const data = parseFrontmatter(content);
    
    if (data.name && data.place_id) {
      places.push({
        ...data,
        category,
        filename: file
      });
    }
  }
  
  return places;
}

// Main
async function main() {
  console.log('Loading coordinate cache...');
  const cache = await loadCache();
  
  console.log('Reading places...');
  const allPlaces = [];
  
  for (const category of CATEGORIES) {
    const places = await readCategory(category);
    console.log(`  ${category}: ${places.length} places`);
    allPlaces.push(...places);
  }
  
  console.log(`\nTotal: ${allPlaces.length} places`);
  console.log('Fetching coordinates...');
  
  const features = [];
  let fetched = 0;
  let cached = 0;
  
  for (const place of allPlaces) {
    const wasCached = !!cache[place.place_id];
    const coords = getCoordinates(place.place_id, cache);
    
    if (!coords) {
      console.log(`  ⚠️  No coords for: ${place.name}`);
      continue;
    }
    
    if (wasCached) cached++;
    else fetched++;
    
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [coords.lng, coords.lat]
      },
      properties: {
        name: place.name,
        category: place.category,
        primary: place.primary || null,  // coffee, bar, restaurant (Food & Drink only)
        type: Array.isArray(place.type) ? place.type : [place.type].filter(Boolean),
        neighborhood: place.neighborhood || null,
        address: place.address || null,
        status: place.status || 'unknown',
        goodFor: place['good-for'] || [],
        cuisine: place.cuisine || [],
        hours: place.hours || [],
        notes: place.notes || null
      }
    });
  }
  
  console.log(`  Cached: ${cached}, Fetched: ${fetched}`);
  
  // Save updated cache
  await saveCache(cache);
  
  // Generate GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    generated: new Date().toISOString(),
    features
  };
  
  await writeFile(OUTPUT_FILE, JSON.stringify(geojson, null, 2));
  console.log(`\n✅ Wrote ${features.length} places to ${OUTPUT_FILE}`);
}

main().catch(console.error);
