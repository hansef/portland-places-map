/**
 * Lightweight integration tests for HTML/CSS/Alpine.js compatibility
 *
 * These tests parse static files to detect common issues:
 * - Script loading order problems
 * - CSS rules that conflict with Alpine.js directives
 * - Missing required DOM elements
 * - Accessibility issues
 * - Asset references
 *
 * Run with: node tests/integration.test.js
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Simple test runner
let passed = 0;
let failed = 0;
let skipped = 0;

function describe(name, fn) {
  console.log(`\n--- ${name} ---`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    if (err.message.startsWith('SKIP:')) {
      skipped++;
      console.log(`○ ${name} (skipped)`);
    } else {
      failed++;
      console.log(`✗ ${name}`);
      console.log(`  ${err.message}`);
    }
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function skip(reason) {
  throw new Error(`SKIP: ${reason}`);
}

// Load files
const html = readFileSync(join(rootDir, 'index.html'), 'utf-8');
const css = readFileSync(join(rootDir, 'styles.css'), 'utf-8');
const appJs = readFileSync(join(rootDir, 'app.js'), 'utf-8');
const sharedJs = existsSync(join(rootDir, 'shared.js'))
  ? readFileSync(join(rootDir, 'shared.js'), 'utf-8')
  : '';

// ============================================
// HTML Structure Tests
// ============================================

describe('HTML Structure', () => {
  test('has required meta tags', () => {
    assert(html.includes('<meta charset'), 'Missing charset meta');
    assert(html.includes('viewport'), 'Missing viewport meta');
  });

  test('has map container element', () => {
    assert(html.includes('id="map"'), 'Missing #map element for Leaflet');
  });

  test('no duplicate IDs', () => {
    const idMatches = html.matchAll(/id="([^"]+)"/g);
    const ids = [];
    const duplicates = [];

    for (const match of idMatches) {
      if (ids.includes(match[1])) {
        duplicates.push(match[1]);
      }
      ids.push(match[1]);
    }

    assert(
      duplicates.length === 0,
      `Duplicate IDs found: ${duplicates.join(', ')}`
    );
  });

  test('interactive elements have accessible names', () => {
    // Check that buttons with title attribute exist (simpler check)
    const buttonsWithTitle = (html.match(/<button[^>]*title="[^"]+"/g) || []).length;
    const totalButtons = (html.match(/<button/g) || []).length;

    // At least some buttons should have titles for accessibility
    assert(
      buttonsWithTitle > 0 || totalButtons === 0,
      'No buttons have title attributes - consider adding for accessibility'
    );
  });
});

// ============================================
// Asset & Dependency Tests
// ============================================

describe('Assets & Dependencies', () => {
  test('local CSS file exists', () => {
    const cssRef = html.match(/href="([^"]*\.css)"/g) || [];
    for (const ref of cssRef) {
      const path = ref.match(/href="([^"]+)"/)[1];
      if (!path.startsWith('http')) {
        assert(
          existsSync(join(rootDir, path)),
          `Referenced CSS file not found: ${path}`
        );
      }
    }
  });

  test('local JS files exist', () => {
    const jsRefs = html.matchAll(/src="([^"]+\.js)"/g);
    for (const match of jsRefs) {
      const path = match[1];
      if (!path.startsWith('http')) {
        assert(
          existsSync(join(rootDir, path)),
          `Referenced JS file not found: ${path}`
        );
      }
    }
  });

  test('external dependencies use HTTPS', () => {
    const httpRefs = html.match(/http:\/\/[^"'\s]+/g) || [];
    const nonLocalHttp = httpRefs.filter(url => !url.includes('localhost'));

    assert(
      nonLocalHttp.length === 0,
      `External resources should use HTTPS: ${nonLocalHttp.join(', ')}`
    );
  });

  test('CDN dependencies have integrity or are from trusted sources', () => {
    // Just check that CDN URLs are from known providers
    const cdnPatterns = [
      /unpkg\.com/,
      /cdn\.jsdelivr\.net/,
      /cdnjs\.cloudflare\.com/,
      /fonts\.googleapis\.com/,
      /fonts\.gstatic\.com/
    ];

    const externalScripts = html.matchAll(/src="(https:\/\/[^"]+)"/g);
    for (const match of externalScripts) {
      const url = match[1];
      const isTrusted = cdnPatterns.some(pattern => pattern.test(url));
      assert(isTrusted, `Unknown CDN source: ${url}`);
    }
  });
});

// ============================================
// Alpine.js Integration Tests
// ============================================

describe('Alpine.js Integration', () => {
  test('shared.js loads before inline Alpine script', () => {
    const sharedPos = html.indexOf('src="shared.js"');
    const alpineInitPos = html.indexOf('alpine:init');

    assert(
      sharedPos !== -1,
      'shared.js should be loaded in index.html'
    );
    assert(
      sharedPos < alpineInitPos,
      'shared.js must load BEFORE alpine:init registration'
    );
  });

  test('popup template exists with required structure', () => {
    assert(
      html.includes('id="popup-template"'),
      'Missing popup template (#popup-template)'
    );
    assert(
      html.includes('<template id="popup-template">'),
      'Popup template should be a <template> element'
    );
    assert(
      html.includes('x-text="place.name"'),
      'Popup template should use local place data (x-text="place.name")'
    );
  });

  test('Alpine plugins load before core Alpine', () => {
    const collapsePos = html.indexOf('alpinejs/collapse') !== -1
      ? html.indexOf('alpinejs/collapse')
      : html.indexOf('@alpinejs/collapse');
    const corePos = html.lastIndexOf('alpinejs@') !== -1
      ? html.lastIndexOf('alpinejs@')
      : html.lastIndexOf('/alpinejs/');

    if (collapsePos !== -1 && corePos !== -1) {
      assert(
        collapsePos < corePos,
        'Alpine plugins must load BEFORE core Alpine.js'
      );
    }
  });

  test('Alpine store registered in alpine:init event', () => {
    assert(
      html.includes("alpine:init") && html.includes("Alpine.store"),
      'Alpine store should be registered in alpine:init event listener'
    );
  });

  test('no x-data references to undefined stores', () => {
    // Find all $store references
    const storeRefs = html.matchAll(/\$store\.(\w+)/g);
    const referencedStores = new Set();
    for (const match of storeRefs) {
      referencedStores.add(match[1]);
    }

    // Find all registered stores
    const storeRegistrations = html.matchAll(/Alpine\.store\(['"](\w+)['"]/g);
    const registeredStores = new Set();
    for (const match of storeRegistrations) {
      registeredStores.add(match[1]);
    }

    const undefined_stores = [...referencedStores].filter(s => !registeredStores.has(s));
    assert(
      undefined_stores.length === 0,
      `References to unregistered Alpine stores: ${undefined_stores.join(', ')}`
    );
  });

  test('Alpine Collapse plugin loaded when x-collapse used', () => {
    if (html.includes('x-collapse')) {
      assert(
        html.includes('alpinejs/collapse') || html.includes('@alpinejs/collapse'),
        'x-collapse directive used but Alpine Collapse plugin not loaded'
      );
    }
  });
});

// ============================================
// CSS/Alpine Conflict Tests
// ============================================

describe('CSS/Alpine Compatibility', () => {
  test('no display:none on elements using x-show', () => {
    // Find all class names used with x-show
    const xShowMatches = html.matchAll(/class="([^"]+)"[^>]*x-show|x-show[^>]*class="([^"]+)"/g);
    const xShowClasses = new Set();

    for (const match of xShowMatches) {
      const classes = (match[1] || match[2] || '').split(/\s+/);
      classes.forEach(c => c && xShowClasses.add(c));
    }

    // Check CSS for conflicting display:none rules
    const conflicts = [];
    for (const className of xShowClasses) {
      // Look for .classname { ... display: none ... } (direct rule, not nested)
      const cssRule = new RegExp(`\\.${className}\\s*\\{[^}]*display\\s*:\\s*none`, 'i');
      if (cssRule.test(css)) {
        conflicts.push(className);
      }
    }

    assert(
      conflicts.length === 0,
      `CSS "display: none" conflicts with Alpine x-show on: .${conflicts.join(', .')}. ` +
      'Remove CSS display:none and let Alpine handle visibility.'
    );
  });

  test('x-cloak style exists for hiding pre-Alpine content', () => {
    // x-cloak is used to hide elements until Alpine initializes
    if (html.includes('x-cloak')) {
      assert(
        css.includes('[x-cloak]') || html.includes('[x-cloak]'),
        'x-cloak used but no [x-cloak] CSS rule found. Add: [x-cloak] { display: none !important; }'
      );
    }
  });
});

// ============================================
// JavaScript Quality Tests
// ============================================

describe('JavaScript Quality', () => {
  test('no console.log in production code (console.error allowed)', () => {
    // Allow console.error and console.warn for legitimate error handling
    const allJs = appJs + '\n' + sharedJs;
    const consoleLogs = allJs.match(/console\.log\(/g) || [];
    assert(
      consoleLogs.length === 0,
      `Found ${consoleLogs.length} console.log() calls - remove for production`
    );
  });

  test('no debugger statements', () => {
    assert(
      !appJs.includes('debugger'),
      'Remove debugger statements for production'
    );
  });

  test('uses strict equality', () => {
    // Simple check: count == vs === (excluding !== and ==)
    // Split by lines to avoid regex complexity
    let looseCount = 0;
    for (const line of appJs.split('\n')) {
      // Skip comments and strings (rough heuristic)
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      // Count == that aren't part of === or !==
      const matches = line.match(/[^!=]==[^=]/g) || [];
      looseCount += matches.length;
    }
    assert(
      looseCount === 0,
      `Found ${looseCount} loose equality (==) comparisons - prefer ===`
    );
  });

  test('no deprecated APIs', () => {
    const deprecated = [
      { pattern: /\.substr\(/, name: 'substr()' },
      { pattern: /document\.write\(/, name: 'document.write()' },
      { pattern: /\.anchor\(/, name: 'String.anchor()' },
    ];

    for (const { pattern, name } of deprecated) {
      assert(!pattern.test(appJs), `Deprecated API used: ${name}`);
    }
  });

  test('exports are properly declared', () => {
    assert(
      appJs.includes('export function init') || appJs.includes('export { init'),
      'init function should be exported'
    );
  });
});

// ============================================
// Data Tests
// ============================================

describe('Data Files', () => {
  test('places.geojson is valid if present', () => {
    const geojsonPath = join(rootDir, 'places.geojson');
    if (!existsSync(geojsonPath)) {
      skip('places.geojson not found (may not be generated yet)');
    }

    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'));
    assert(geojson.type === 'FeatureCollection', 'Should be a FeatureCollection');
    assert(Array.isArray(geojson.features), 'Should have features array');
    assert(geojson.features.length > 0, 'Should have at least one feature');
  });

  test('GeoJSON features have required properties', () => {
    const geojsonPath = join(rootDir, 'places.geojson');
    if (!existsSync(geojsonPath)) {
      skip('places.geojson not found');
    }

    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'));
    const requiredProps = ['name', 'category'];
    const missing = [];

    for (const feature of geojson.features.slice(0, 10)) { // Check first 10
      for (const prop of requiredProps) {
        if (!feature.properties[prop]) {
          missing.push(`${feature.properties.name || 'unnamed'}: missing ${prop}`);
        }
      }
      // Check coordinates
      if (!feature.geometry?.coordinates ||
          feature.geometry.coordinates.length !== 2) {
        missing.push(`${feature.properties.name || 'unnamed'}: invalid coordinates`);
      }
    }

    assert(missing.length === 0, `GeoJSON issues:\n  ${missing.join('\n  ')}`);
  });
});

// ============================================
// Results
// ============================================

console.log('\n-------------------');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (skipped > 0) {
  console.log(`Skipped: ${skipped}`);
}
console.log('-------------------');

process.exit(failed > 0 ? 1 : 0);
