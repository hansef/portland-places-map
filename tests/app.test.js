/**
 * Simple test harness for app.js pure functions
 * Run with: node tests/app.test.js
 */

// Set up global PlacesConfig before importing app.js
// (In browser, shared.js sets window.PlacesConfig; in Node, we mock it)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Execute shared.js in a context with a mock window object
const sharedCode = readFileSync(join(__dirname, '..', 'shared.js'), 'utf-8');
const mockWindow = {};
vm.runInNewContext(sharedCode, { window: mockWindow });
globalThis.PlacesConfig = mockWindow.PlacesConfig;

// Now import app.js (which reads from globalThis.PlacesConfig)
const {
  slugify,
  findCategoryBySlug,
  decodeFilterHash,
  encodeFilterHash,
  filterPlaces,
  groupPlacesByCategory,
  formatWebsiteDisplay,
  getPlaceIcon
} = await import('../app.js');

// Simple test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`✗ ${name}`);
    console.log(`  ${err.message}`);
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}", got "${actual}"`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Mock data for tests
const mockPlaces = [
  {
    properties: {
      name: "Powell's Books",
      category: 'Bookstores',
      status: 'haunts',
      neighborhood: 'Pearl District'
    },
    geometry: { coordinates: [-122.68, 45.52] }
  },
  {
    properties: {
      name: 'Heart Coffee',
      category: 'Food & Drink',
      status: 'haunts',
      primary: 'coffee',
      neighborhood: 'Kerns'
    },
    geometry: { coordinates: [-122.65, 45.52] }
  },
  {
    properties: {
      name: 'Pok Pok',
      category: 'Food & Drink',
      status: 'queue',
      primary: 'restaurant',
      neighborhood: 'Division'
    },
    geometry: { coordinates: [-122.63, 45.50] }
  },
  {
    properties: {
      name: "McMenamins",
      category: 'Food & Drink',
      status: 'haunts',
      primary: 'bar',
      neighborhood: 'Hawthorne'
    },
    geometry: { coordinates: [-122.62, 45.51] }
  }
];

// ===== SLUGIFY TESTS =====

console.log('\n--- slugify ---');

test('converts to lowercase', () => {
  assertEqual(slugify('Hello World'), 'hello-world');
});

test('removes apostrophes', () => {
  assertEqual(slugify("Powell's Books"), 'powells-books');
});

test('removes curly apostrophes', () => {
  assertEqual(slugify("It's Fine"), 'its-fine');
});

test('replaces spaces with hyphens', () => {
  assertEqual(slugify('Food & Drink'), 'food-drink');
});

test('handles multiple special characters', () => {
  assertEqual(slugify('Arts & Culture!'), 'arts-culture');
});

test('trims leading/trailing hyphens', () => {
  assertEqual(slugify('  hello  '), 'hello');
});

// ===== FIND CATEGORY BY SLUG TESTS =====

console.log('\n--- findCategoryBySlug ---');

test('returns "all" for empty slug', () => {
  assertEqual(findCategoryBySlug('', mockPlaces), 'all');
});

test('returns "all" for "all" slug', () => {
  assertEqual(findCategoryBySlug('all', mockPlaces), 'all');
});

test('finds Food & Drink category', () => {
  assertEqual(findCategoryBySlug('food-drink', mockPlaces), 'Food & Drink');
});

test('finds Bookstores category', () => {
  assertEqual(findCategoryBySlug('bookstores', mockPlaces), 'Bookstores');
});

test('returns null for unknown category', () => {
  assertEqual(findCategoryBySlug('unknown-cat', mockPlaces), null);
});

// ===== DECODE FILTER HASH TESTS =====

console.log('\n--- decodeFilterHash ---');

test('returns defaults for empty hash', () => {
  assertDeepEqual(
    decodeFilterHash('', mockPlaces),
    { status: 'all', category: 'all', primary: 'all' }
  );
});

test('returns defaults for # only', () => {
  assertDeepEqual(
    decodeFilterHash('#', mockPlaces),
    { status: 'all', category: 'all', primary: 'all' }
  );
});

test('decodes status only', () => {
  assertDeepEqual(
    decodeFilterHash('#haunts', mockPlaces),
    { status: 'haunts', category: 'all', primary: 'all' }
  );
});

test('decodes status and category', () => {
  assertDeepEqual(
    decodeFilterHash('#queue/food-drink', mockPlaces),
    { status: 'queue', category: 'Food & Drink', primary: 'all' }
  );
});

test('decodes full filter with primary', () => {
  assertDeepEqual(
    decodeFilterHash('#haunts/food-drink/coffee', mockPlaces),
    { status: 'haunts', category: 'Food & Drink', primary: 'coffee' }
  );
});

test('ignores primary for non-Food & Drink', () => {
  assertDeepEqual(
    decodeFilterHash('#haunts/bookstores/coffee', mockPlaces),
    { status: 'haunts', category: 'Bookstores', primary: 'all' }
  );
});

// ===== ENCODE FILTER HASH TESTS =====

console.log('\n--- encodeFilterHash ---');

test('returns empty for all defaults', () => {
  assertEqual(
    encodeFilterHash({ status: 'all', category: 'all', primary: 'all' }),
    ''
  );
});

test('encodes status only', () => {
  assertEqual(
    encodeFilterHash({ status: 'haunts', category: 'all', primary: 'all' }),
    '#haunts'
  );
});

test('encodes category with "all" status prefix', () => {
  assertEqual(
    encodeFilterHash({ status: 'all', category: 'Food & Drink', primary: 'all' }),
    '#all/food-drink'
  );
});

test('encodes full filter', () => {
  assertEqual(
    encodeFilterHash({ status: 'queue', category: 'Food & Drink', primary: 'bar' }),
    '#queue/food-drink/bar'
  );
});

// ===== FILTER PLACES TESTS =====

console.log('\n--- filterPlaces ---');

test('returns all places with default filter', () => {
  const result = filterPlaces(mockPlaces, { status: 'all', category: 'all', primary: 'all' });
  assertEqual(result.length, 4);
});

test('filters by status', () => {
  const result = filterPlaces(mockPlaces, { status: 'haunts', category: 'all', primary: 'all' });
  assertEqual(result.length, 3);
  assert(result.every(p => p.properties.status === 'haunts'));
});

test('filters by category', () => {
  const result = filterPlaces(mockPlaces, { status: 'all', category: 'Food & Drink', primary: 'all' });
  assertEqual(result.length, 3);
});

test('filters by primary type', () => {
  const result = filterPlaces(mockPlaces, { status: 'all', category: 'Food & Drink', primary: 'coffee' });
  assertEqual(result.length, 1);
  assertEqual(result[0].properties.name, 'Heart Coffee');
});

test('combines status and category filters', () => {
  const result = filterPlaces(mockPlaces, { status: 'haunts', category: 'Food & Drink', primary: 'all' });
  assertEqual(result.length, 2);
});

// ===== GROUP PLACES BY CATEGORY TESTS =====

console.log('\n--- groupPlacesByCategory ---');

test('groups places correctly', () => {
  const result = groupPlacesByCategory(mockPlaces);
  assertEqual(Object.keys(result).length, 2);
  assertEqual(result['Bookstores'].length, 1);
  assertEqual(result['Food & Drink'].length, 3);
});

// ===== FORMAT WEBSITE DISPLAY TESTS =====

console.log('\n--- formatWebsiteDisplay ---');

test('returns null for empty url', () => {
  assertEqual(formatWebsiteDisplay(null), null);
  assertEqual(formatWebsiteDisplay(''), null);
});

test('extracts Instagram username', () => {
  assertEqual(formatWebsiteDisplay('https://instagram.com/heartcoffee'), '@heartcoffee');
});

test('extracts Facebook page', () => {
  assertEqual(formatWebsiteDisplay('https://facebook.com/powellsbooks'), '@powellsbooks');
});

test('extracts Twitter username', () => {
  assertEqual(formatWebsiteDisplay('https://twitter.com/pokpokpdx'), '@pokpokpdx');
});

test('extracts X.com username', () => {
  assertEqual(formatWebsiteDisplay('https://x.com/someuser'), '@someuser');
});

test('returns domain for regular URLs', () => {
  assertEqual(formatWebsiteDisplay('https://www.heartroasters.com/'), 'www.heartroasters.com');
});

// ===== GET PLACE ICON TESTS =====

console.log('\n--- getPlaceIcon ---');

test('returns primary icon for Food & Drink with coffee', () => {
  assertEqual(getPlaceIcon('Food & Drink', 'coffee'), 'fa-mug-hot');
});

test('returns primary icon for Food & Drink with bar', () => {
  assertEqual(getPlaceIcon('Food & Drink', 'bar'), 'fa-martini-glass');
});

test('returns category icon when no primary', () => {
  assertEqual(getPlaceIcon('Bookstores', null), 'fa-book');
});

test('returns default icon for unknown category', () => {
  assertEqual(getPlaceIcon('Unknown', null), 'fa-location-dot');
});

// ===== SUMMARY =====

console.log('\n-------------------');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('-------------------\n');

process.exit(failed > 0 ? 1 : 0);
