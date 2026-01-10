// ===== SHARED CONFIG ACCESS =====
// shared.js is loaded as a classic script before this module, setting window.PlacesConfig.
// We use globalThis to work in both browser (window) and Node.js (for tests).

const {
  statusColors,
  categoryIcons,
  primaryIcons,
  slugify,
  getPlaceIcon,
  formatWebsiteDisplay,
  encodeFilterHash
} = globalThis.PlacesConfig || window.PlacesConfig;

// Re-export for backwards compatibility (tests import from app.js)
export { statusColors, categoryIcons, primaryIcons, slugify, getPlaceIcon, formatWebsiteDisplay, encodeFilterHash };

/**
 * Find category name from slug, given list of places
 */
export function findCategoryBySlug(slug, places) {
  if (!slug || slug === 'all') return 'all';
  const feature = places.find(f => slugify(f.properties.category) === slug);
  return feature ? feature.properties.category : null;
}

/**
 * Decode URL hash to filter state object
 */
export function decodeFilterHash(hash, places = []) {
  const result = { status: 'all', category: 'all', primary: 'all' };

  if (!hash || hash === '#') return result;

  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (parts.length === 0) return result;

  const validStatuses = ['all', 'haunts', 'queue'];
  const validPrimaries = ['coffee', 'bar', 'restaurant'];

  let idx = 0;

  if (validStatuses.includes(parts[0])) {
    result.status = parts[0] === 'all' ? 'all' : parts[0];
    idx = 1;
  }

  if (parts[idx]) {
    const category = findCategoryBySlug(parts[idx], places);
    if (category) {
      result.category = category;
      idx++;
    }
  }

  if (parts[idx] && result.category === 'Food & Drink') {
    if (validPrimaries.includes(parts[idx])) {
      result.primary = parts[idx];
    }
  }

  return result;
}

/**
 * Filter places based on filter state
 */
export function filterPlaces(places, filterState) {
  return places.filter(feature => {
    const props = feature.properties;
    if (filterState.status !== 'all' && props.status !== filterState.status) return false;
    if (filterState.category !== 'all' && props.category !== filterState.category) return false;
    if (filterState.primary !== 'all' && props.category === 'Food & Drink') {
      if (props.primary !== filterState.primary) return false;
    }
    return true;
  });
}

/**
 * Group places by category
 */
export function groupPlacesByCategory(places) {
  const byCategory = {};
  places.forEach((feature, index) => {
    const category = feature.properties.category;
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push({ feature, index });
  });
  return byCategory;
}

// ===== MAP LOGIC =====

let map, markers;

function createMarkerIcon(status, category, primary) {
  const statusClass = `marker-${status || 'unknown'}`;
  const iconClass = getPlaceIcon(category, primary);

  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="place-marker ${statusClass}"><i class="fa-solid ${iconClass}"></i></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
}

/**
 * Create popup element using Alpine template.
 * Clones #popup-template, sets up data in Alpine store, and initializes Alpine on the element.
 *
 * @param {Object} props - Place properties from GeoJSON feature
 * @returns {HTMLElement} - Popup element ready for Leaflet
 */
function createPopupElement(props) {
  const template = document.getElementById('popup-template');
  if (!template) {
    console.error('Popup template not found');
    const fallback = document.createElement('div');
    fallback.textContent = props.name;
    return fallback;
  }

  // Pre-process data for Alpine template
  const processedProps = { ...props };

  // Process hours data
  if (props.hours && Array.isArray(props.hours) && props.hours.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = dayNames[new Date().getDay()];

    const todayHours = props.hours.find(h => h.startsWith(today));
    processedProps.todayName = today;
    processedProps.todayHours = todayHours ? todayHours.replace(`${today}: `, '') : 'Hours not listed';

    // Create ordered hours array starting from today
    const todayIndex = dayNames.indexOf(today);
    const orderedDays = [...dayNames.slice(todayIndex), ...dayNames.slice(0, todayIndex)];

    processedProps.orderedHours = orderedDays.map(day => {
      const dayHours = props.hours.find(h => h.startsWith(day));
      return {
        name: day,
        time: dayHours ? dayHours.replace(`${day}: `, '') : '',
        isToday: day === today
      };
    }).filter(d => d.time);
  }

  // Process website display
  if (props.website) {
    processedProps.websiteDisplay = formatWebsiteDisplay(props.website);
  }

  // Combine tags
  processedProps.tags = [
    ...(props.type || []),
    ...(props.cuisine || []),
    ...(props.goodFor || [])
  ].filter(Boolean);

  // Clean up notes
  processedProps.notes = (props.notes && typeof props.notes === 'string' && props.notes.trim())
    ? props.notes
    : null;

  // Update Alpine store with current place data
  const store = window.Alpine?.store('app');
  if (store) {
    store.currentPlace = processedProps;
  }

  // Clone template and initialize Alpine
  const clone = template.content.cloneNode(true);
  const popupElement = clone.querySelector('.popup-content') || clone.firstElementChild;

  if (window.Alpine && popupElement) {
    Alpine.initTree(popupElement);
  }

  return popupElement;
}

// ===== MAP APP CLASS =====

class MapApp {
  constructor() {
    this.userMarker = null;
    this.userCircle = null;
  }

  get store() {
    return window.Alpine?.store('app');
  }

  init() {
    map = L.map('map').setView([45.52, -122.67], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    markers = L.markerClusterGroup({
      maxClusterRadius: 10,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      showCoverageOnHover: false,
      spiderfyDistanceMultiplier: 1.5,
      animate: true,
      animateAddingMarkers: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: 'marker-cluster marker-cluster-small',
          iconSize: L.point(36, 36)
        });
      }
    }).addTo(map);

    this.loadPlaces();
    this.setupMapEvents();
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  async loadPlaces() {
    try {
      const res = await fetch('places.geojson');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();

      if (this.store) {
        this.store.places = data.features;
        this.store.categories = [...new Set(data.features.map(f => f.properties.category))].sort();
      }

      this.renderMarkers();

      if (window.location.hash) {
        this.handleInitialHash();
      } else if (this.store?.places.length > 0) {
        const bounds = L.latLngBounds(this.store.places.map(f => [
          f.geometry.coordinates[1],
          f.geometry.coordinates[0]
        ]));
        map.fitBounds(bounds, {
          paddingTopLeft: [80, 70],
          paddingBottomRight: [60, 80]
        });
      }
    } catch (err) {
      console.error('Failed to load places:', err);
      if (this.store) {
        this.store.ui.loadError = 'Failed to load places. Please refresh the page.';
      }
    }
  }

  renderMarkers() {
    if (!this.store) return;

    markers.clearLayers();
    let count = 0;

    this.store.places.forEach((feature, index) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      if (this.store.filter.status !== 'all' && props.status !== this.store.filter.status) return;
      if (this.store.filter.category !== 'all' && props.category !== this.store.filter.category) return;
      if (this.store.filter.primary !== 'all' && props.category === 'Food & Drink') {
        if (props.primary !== this.store.filter.primary) return;
      }

      const marker = L.marker([coords[1], coords[0]], {
        icon: createMarkerIcon(props.status, props.category, props.primary)
      });
      marker.placeIndex = index;
      marker.bindPopup(() => createPopupElement(props), { maxWidth: 280 });
      markers.addLayer(marker);
      count++;
    });

    this.store.ui.placeCount = count;
  }

  jumpToPlace(placeIndex) {
    if (!this.store) return;

    const feature = this.store.places[placeIndex];
    if (!feature) return;

    this.renderMarkers();

    let targetMarker = null;
    markers.eachLayer(marker => {
      if (marker.placeIndex === placeIndex) {
        targetMarker = marker;
      }
    });

    if (targetMarker) {
      markers.zoomToShowLayer(targetMarker, () => {
        targetMarker.openPopup();
      });
    }
  }

  locateUser() {
    map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });
  }

  setupMapEvents() {
    map.on('locationfound', (e) => {
      const radius = e.accuracy / 2;

      if (this.userMarker) map.removeLayer(this.userMarker);
      if (this.userCircle) map.removeLayer(this.userCircle);

      this.userMarker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: 'user-location',
          html: '<div style="width:14px;height:14px;background:#6b8cae;border:3px solid #f7f5f0;border-radius:50%;box-shadow:0 2px 8px rgba(107,140,174,0.4);"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).addTo(map).bindPopup("It's a me!").openPopup();

      this.userCircle = L.circle(e.latlng, {
        radius,
        color: '#6b8cae',
        fillColor: '#6b8cae',
        fillOpacity: 0.1,
        weight: 1.5
      }).addTo(map);

      if (this.store) {
        this.store.ui.locating = false;
      }
    });

    map.on('locationerror', (e) => {
      alert('Could not get location: ' + e.message);
      if (this.store) {
        this.store.ui.locating = false;
      }
    });

    map.on('popupopen', (e) => {
      const marker = e.popup._source;
      if (marker && typeof marker.placeIndex === 'number' && this.store) {
        const feature = this.store.places[marker.placeIndex];
        if (feature) {
          const slug = slugify(feature.properties.name);
          history.replaceState(null, '', `#place/${slug}`);
        }
      }
    });

    map.on('popupclose', () => {
      if (this.store?.hasActiveFilters) {
        this.store.updateHash();
      } else {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    });
  }

  handleInitialHash() {
    const hash = window.location.hash;
    if (!hash || hash === '#' || !this.store) return;

    if (hash.startsWith('#place/')) {
      const slug = decodeURIComponent(hash.replace('#place/', ''));
      const placeIndex = this.store.places.findIndex(f =>
        slugify(f.properties.name) === slug
      );
      if (placeIndex >= 0) {
        this.jumpToPlace(placeIndex);
      }
    } else {
      const decoded = decodeFilterHash(hash, this.store.places);
      this.store.filter.status = decoded.status;
      this.store.filter.category = decoded.category;
      this.store.filter.primary = decoded.primary;
      this.renderMarkers();

      if (this.store.hasActiveFilters) {
        const visiblePlaces = filterPlaces(this.store.places, this.store.filter);
        if (visiblePlaces.length > 0) {
          const bounds = L.latLngBounds(visiblePlaces.map(f => [
            f.geometry.coordinates[1],
            f.geometry.coordinates[0]
          ]));
          map.fitBounds(bounds, {
            paddingTopLeft: [80, 70],
            paddingBottomRight: [60, 80]
          });
        }
      }
    }
  }

  handleHashChange() {
    const hash = window.location.hash;
    if (!this.store) return;

    if (hash.startsWith('#place/')) {
      const slug = decodeURIComponent(hash.replace('#place/', ''));
      const placeIndex = this.store.places.findIndex(f =>
        slugify(f.properties.name) === slug
      );
      if (placeIndex >= 0) {
        this.store.closeAllPanels();
        this.store.filter.status = 'all';
        this.store.filter.category = 'all';
        this.store.filter.primary = 'all';
        this.jumpToPlace(placeIndex);
      }
    } else if (hash && hash !== '#') {
      const decoded = decodeFilterHash(hash, this.store.places);
      this.store.filter.status = decoded.status;
      this.store.filter.category = decoded.category;
      this.store.filter.primary = decoded.primary;
      this.renderMarkers();
    } else {
      this.store.filter.status = 'all';
      this.store.filter.category = 'all';
      this.store.filter.primary = 'all';
      this.renderMarkers();
    }
  }
}

// ===== INITIALIZATION =====

export function init() {
  // Prevent double initialization
  if (window._mapApp) {
    return;
  }

  const mapApp = new MapApp();
  window._mapApp = mapApp;

  // Wait a tick for Alpine to initialize, then init map
  setTimeout(() => {
    mapApp.init();
  }, 0);

  // Keyboard handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.Alpine) {
      Alpine.store('app').closeAllPanels();
    }
  });
}
