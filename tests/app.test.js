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

// Set up MiniSearch globally (in browser it's loaded via script tag)
const MiniSearch = (await import('minisearch')).default;
globalThis.MiniSearch = MiniSearch;

// Now import app.js (which reads from globalThis.PlacesConfig and globalThis.MiniSearch)
const {
  slugify,
  findCategoryBySlug,
  decodeFilterHash,
  encodeFilterHash,
  filterPlaces,
  searchPlaces,
  groupPlacesByCategory,
  formatWebsiteDisplay,
  getPlaceIcon,
  getOpenStatus
} = await import('../app.js');

// Also get hours parsing functions from PlacesConfig
const {
  parseTime,
  parseTimeRange,
  getTodayHours,
  formatMinutesAsTime
} = globalThis.PlacesConfig;

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
    { status: 'all', category: 'all', primary: 'all', openNow: false }
  );
});

test('returns defaults for # only', () => {
  assertDeepEqual(
    decodeFilterHash('#', mockPlaces),
    { status: 'all', category: 'all', primary: 'all', openNow: false }
  );
});

test('decodes status only', () => {
  assertDeepEqual(
    decodeFilterHash('#haunts', mockPlaces),
    { status: 'haunts', category: 'all', primary: 'all', openNow: false }
  );
});

test('decodes status and category', () => {
  assertDeepEqual(
    decodeFilterHash('#queue/food-drink', mockPlaces),
    { status: 'queue', category: 'Food & Drink', primary: 'all', openNow: false }
  );
});

test('decodes full filter with primary', () => {
  assertDeepEqual(
    decodeFilterHash('#haunts/food-drink/coffee', mockPlaces),
    { status: 'haunts', category: 'Food & Drink', primary: 'coffee', openNow: false }
  );
});

test('ignores primary for non-Food & Drink', () => {
  assertDeepEqual(
    decodeFilterHash('#haunts/bookstores/coffee', mockPlaces),
    { status: 'haunts', category: 'Bookstores', primary: 'all', openNow: false }
  );
});

test('decodes open-now prefix', () => {
  assertDeepEqual(
    decodeFilterHash('#open-now', mockPlaces),
    { status: 'all', category: 'all', primary: 'all', openNow: true }
  );
});

test('decodes open-now with filters', () => {
  assertDeepEqual(
    decodeFilterHash('#open-now/haunts/food-drink', mockPlaces),
    { status: 'haunts', category: 'Food & Drink', primary: 'all', openNow: true }
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

test('encodes openNow only', () => {
  assertEqual(
    encodeFilterHash({ status: 'all', category: 'all', primary: 'all', openNow: true }),
    '#open-now'
  );
});

test('encodes openNow with filters', () => {
  assertEqual(
    encodeFilterHash({ status: 'haunts', category: 'Food & Drink', primary: 'all', openNow: true }),
    '#open-now/haunts/food-drink'
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

// ===== HOURS PARSING TESTS =====

console.log('\n--- parseTime ---');

test('parses time with AM', () => {
  assertEqual(parseTime('9:00 AM'), 540); // 9 * 60 = 540
});

test('parses time with PM', () => {
  assertEqual(parseTime('3:00 PM'), 900); // 15 * 60 = 900
});

test('parses 12:00 PM as noon', () => {
  assertEqual(parseTime('12:00 PM'), 720); // 12 * 60 = 720
});

test('parses 12:00 AM as midnight', () => {
  assertEqual(parseTime('12:00 AM'), 0);
});

test('infers PM for end time when start is PM', () => {
  // "9:00" as end time when start is 720 (noon) should be 9 PM = 21:00 = 1260
  assertEqual(parseTime('9:00', true, 720), 1260);
});

console.log('\n--- parseTimeRange ---');

test('parses standard time range', () => {
  const result = parseTimeRange('9:00 AM – 5:00 PM');
  assertEqual(result.length, 1);
  assertEqual(result[0].start, 540);
  assertEqual(result[0].end, 1020);
});

test('returns null for Closed', () => {
  assertEqual(parseTimeRange('Closed'), null);
});

test('parses 24 hours', () => {
  const result = parseTimeRange('Open 24 hours');
  assertEqual(result.length, 1);
  assertEqual(result[0].is24h, true);
});

test('parses split shifts', () => {
  const result = parseTimeRange('11:00 AM – 3:00 PM, 5:00 – 10:00 PM');
  assertEqual(result.length, 2);
  assertEqual(result[0].start, 660); // 11 AM
  assertEqual(result[0].end, 900);   // 3 PM
  assertEqual(result[1].start, 1020); // 5 PM
  assertEqual(result[1].end, 1320);   // 10 PM
});

console.log('\n--- formatMinutesAsTime ---');

test('formats morning time', () => {
  assertEqual(formatMinutesAsTime(540), '9:00 AM');
});

test('formats afternoon time', () => {
  assertEqual(formatMinutesAsTime(900), '3:00 PM');
});

test('formats midnight', () => {
  assertEqual(formatMinutesAsTime(0), '12:00 AM');
});

test('formats noon', () => {
  assertEqual(formatMinutesAsTime(720), '12:00 PM');
});

console.log('\n--- getOpenStatus ---');

test('returns unknown for empty hours', () => {
  const result = getOpenStatus([]);
  assertEqual(result.status, 'unknown');
  assertEqual(result.isOpen, false);
});

test('returns unknown for null hours', () => {
  const result = getOpenStatus(null);
  assertEqual(result.status, 'unknown');
  assertEqual(result.isOpen, false);
});

// ===== SEARCH PLACES TESTS =====

// Extended mock data with searchable fields (including notes for Fuse.js)
const searchMockPlaces = [
  {
    properties: {
      name: "Powell's Books",
      category: 'Bookstores',
      status: 'haunts',
      neighborhood: 'Pearl District',
      type: ['independent'],
      cuisine: [],
      goodFor: ['browsing', 'rainy days'],
      notes: 'The largest independent bookstore in the world. Multiple floors of amazing selection.'
    }
  },
  {
    properties: {
      name: 'Heart Coffee',
      category: 'Food & Drink',
      status: 'haunts',
      primary: 'coffee',
      neighborhood: 'Kerns',
      type: ['cafe'],
      cuisine: [],
      goodFor: ['work', 'dates'],
      notes: 'Quality espresso with great latte art. Minimalist Scandinavian vibes.'
    }
  },
  {
    properties: {
      name: 'Pok Pok',
      category: 'Food & Drink',
      status: 'queue',
      primary: 'restaurant',
      neighborhood: 'Division',
      type: [],
      cuisine: ['thai', 'vietnamese'],
      goodFor: ['dinner', 'groups'],
      notes: 'Famous for their fish sauce wings. Funky outdoor seating.'
    }
  },
  {
    properties: {
      name: 'Mississippi Records',
      category: 'Record Shops',
      status: 'haunts',
      neighborhood: 'Mississippi',
      type: ['vinyl'],
      cuisine: [],
      goodFor: ['browsing'],
      notes: 'Tiny shop packed with rare finds. The owners have incredible taste.'
    }
  },
  {
    properties: {
      name: 'Breakside Brewery',
      category: 'Food & Drink',
      status: 'haunts',
      primary: 'bar',
      neighborhood: 'Dekum',
      type: ['brewery'],
      cuisine: [],
      goodFor: ['groups', 'late-night'],
      notes: 'Award-winning IPAs. Their flagship taproom has great pizza too.'
    }
  }
];

console.log('\n--- searchPlaces ---');

test('returns all places for empty query', () => {
  const result = searchPlaces(searchMockPlaces, '');
  assertEqual(result.length, searchMockPlaces.length);
});

test('returns all places for whitespace query', () => {
  const result = searchPlaces(searchMockPlaces, '   ');
  assertEqual(result.length, searchMockPlaces.length);
});

test('returns all places for null query', () => {
  const result = searchPlaces(searchMockPlaces, null);
  assertEqual(result.length, searchMockPlaces.length);
});

test('searches by name (case insensitive)', () => {
  const result = searchPlaces(searchMockPlaces, 'POWELL');
  assertEqual(result.length, 1);
  assertEqual(result[0].properties.name, "Powell's Books");
});

test('searches by partial name', () => {
  const result = searchPlaces(searchMockPlaces, 'coffee');
  assertEqual(result.length, 1);
  assertEqual(result[0].properties.name, 'Heart Coffee');
});

test('searches by neighborhood', () => {
  const result = searchPlaces(searchMockPlaces, 'Pearl');
  assertEqual(result.length >= 1, true);
  // Powell's Books (Pearl District) should be in results
  const hasPowell = result.some(r => r.properties.name === "Powell's Books");
  assertEqual(hasPowell, true);
});

test('searches by type array', () => {
  const result = searchPlaces(searchMockPlaces, 'brewery');
  assertEqual(result.length, 1);
  assertEqual(result[0].properties.name, 'Breakside Brewery');
});

test('searches by cuisine array', () => {
  const result = searchPlaces(searchMockPlaces, 'thai');
  assertEqual(result.length >= 1, true);
  // First result should be the exact match
  assertEqual(result[0].properties.name, 'Pok Pok');
});

test('searches by goodFor array', () => {
  const result = searchPlaces(searchMockPlaces, 'late-night');
  assertEqual(result.length >= 1, true);
  // First result should be the best match
  assertEqual(result[0].properties.name, 'Breakside Brewery');
});

test('returns multiple matches', () => {
  const result = searchPlaces(searchMockPlaces, 'groups');
  assertEqual(result.length, 2); // Pok Pok and Breakside
});

test('returns multiple matches across different fields', () => {
  const result = searchPlaces(searchMockPlaces, 'mississippi');
  assertEqual(result.length, 1); // Mississippi Records (matches both name and neighborhood)
});

test('handles places with missing arrays gracefully', () => {
  const placesWithMissing = [
    { properties: { name: 'Test Place', neighborhood: 'Test' } }
  ];
  const result = searchPlaces(placesWithMissing, 'test');
  assertEqual(result.length, 1);
});

test('composes with filterPlaces correctly', () => {
  // First filter by status, then search
  const filtered = filterPlaces(searchMockPlaces, { status: 'haunts', category: 'all', primary: 'all', openNow: false });
  const searched = searchPlaces(filtered, 'brewery');
  assertEqual(searched.length, 1);
  assertEqual(searched[0].properties.name, 'Breakside Brewery');
});

test('searches by notes field', () => {
  const result = searchPlaces(searchMockPlaces, 'espresso');
  assertEqual(result.length, 1);
  assertEqual(result[0].properties.name, 'Heart Coffee');
});

test('searches notes for unique phrases', () => {
  const result = searchPlaces(searchMockPlaces, 'fish sauce wings');
  assertEqual(result.length >= 1, true);
  // Pok Pok (has "fish sauce wings" in notes) should be first
  assertEqual(result[0].properties.name, 'Pok Pok');
});

test('fuzzy matches with typos in name', () => {
  // "Powells" without apostrophe should still match "Powell's Books"
  const result = searchPlaces(searchMockPlaces, 'powells');
  assertEqual(result.length >= 1, true);
  assertEqual(result[0].properties.name, "Powell's Books");
});

test('prefix matches partial words', () => {
  // "brew" should match "brewery" via prefix matching
  const result = searchPlaces(searchMockPlaces, 'brew');
  assertEqual(result.length >= 1, true);
  assertEqual(result[0].properties.name, 'Breakside Brewery');
});

test('returns results sorted by relevance (name matches first)', () => {
  // "Mississippi" should return Mississippi Records first (name match)
  // even though it also matches the neighborhood
  const result = searchPlaces(searchMockPlaces, 'Mississippi');
  assertEqual(result.length >= 1, true);
  assertEqual(result[0].properties.name, 'Mississippi Records');
});

// ===== SUMMARY =====

console.log('\n-------------------');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('-------------------\n');

process.exit(failed > 0 ? 1 : 0);
