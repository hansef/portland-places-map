// ===== CONFIGURATION =====

export const statusColors = {
  'haunts': '#4a7c59',
  'queue': '#6b8cae',
  'unknown': '#9ca3a3'
};

export const categoryIcons = {
  'Food & Drink': 'fa-utensils',
  'Record Shop': 'fa-record-vinyl',
  'Record Shops': 'fa-record-vinyl',
  'Bookstore': 'fa-book',
  'Bookstores': 'fa-book',
  'Movie Theaters': 'fa-film',
  'Movie Theater': 'fa-film',
  'Provisions': 'fa-cheese',
  'Supplies': 'fa-screwdriver-wrench',
  'Arts & Culture': 'fa-palette',
  'Music Venues': 'fa-music',
  'Clothing': 'fa-shirt'
};

export const primaryIcons = {
  'coffee': 'fa-mug-hot',
  'bar': 'fa-martini-glass',
  'restaurant': 'fa-utensils'
};

// ===== PURE FUNCTIONS (testable) =====

/**
 * Convert a place name to URL-safe slug
 */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
 * Encode filter state to URL hash
 */
export function encodeFilterHash(filterState) {
  const parts = [];

  const hasCategory = filterState.category !== 'all';
  const hasPrimary = filterState.primary !== 'all' && filterState.category === 'Food & Drink';

  if (filterState.status !== 'all') {
    parts.push(filterState.status);
  } else if (hasCategory || hasPrimary) {
    parts.push('all');
  }

  if (hasCategory) {
    parts.push(slugify(filterState.category));
  } else if (hasPrimary) {
    parts.push(slugify('Food & Drink'));
  }

  if (hasPrimary) {
    parts.push(filterState.primary);
  }

  return parts.length > 0 ? '#' + parts.join('/') : '';
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

/**
 * Format website URL for display
 */
export function formatWebsiteDisplay(url) {
  if (!url) return null;

  const igMatch = url.match(/instagram\.com\/([^\/\?]+)/);
  if (igMatch && igMatch[1] !== 'p' && igMatch[1] !== 'explore') {
    return '@' + igMatch[1];
  }

  if (url.includes('facebook.com/')) {
    const fbMatch = url.match(/facebook\.com\/([^\/\?]+)/);
    if (fbMatch) {
      return '@' + fbMatch[1];
    }
  }

  if (url.match(/twitter\.com|^https?:\/\/(www\.)?x\.com/)) {
    const twMatch = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
    if (twMatch) {
      return '@' + twMatch[1];
    }
  }

  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
}

/**
 * Get icon class for a place
 */
export function getPlaceIcon(category, primary) {
  if (category === 'Food & Drink' && primary && primaryIcons[primary]) {
    return primaryIcons[primary];
  }
  return categoryIcons[category] || 'fa-location-dot';
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

function formatPopup(props) {
  const statusClass = `status-${props.status}`;
  const statusLabels = { 'haunts': 'Haunt', 'queue': 'Queue' };
  const statusLabel = statusLabels[props.status] || '';

  let html = `
    <div class="popup-name">
      ${props.name}
      ${statusLabel ? `<span class="status-badge ${statusClass}">${statusLabel}</span>` : ''}
    </div>
    <div class="popup-meta">${props.category}</div>
  `;

  if (props.neighborhood) {
    html += `<div class="popup-meta">${props.neighborhood}</div>`;
  }

  if (props.address) {
    html += `<div class="popup-address">${props.address}</div>`;
  }

  if (props.website) {
    const displayText = formatWebsiteDisplay(props.website);
    html += `<div class="popup-website"><a href="${props.website}" target="_blank" rel="noopener">${displayText}</a></div>`;
  }

  if (props.hours && Array.isArray(props.hours) && props.hours.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = dayNames[new Date().getDay()];
    const popupId = `hours-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const todayHours = props.hours.find(h => h.startsWith(today));
    const todayTime = todayHours ? todayHours.replace(`${today}: `, '') : 'Hours not listed';

    html += `
      <div class="popup-hours">
        <div class="popup-hours-header">
          <i class="fa-regular fa-clock"></i>
          <span>${today}</span>
        </div>
        <div class="popup-hours-today">${todayTime}</div>
        <div class="popup-hours-list" id="${popupId}">
    `;

    const todayIndex = dayNames.indexOf(today);
    const orderedDays = [...dayNames.slice(todayIndex), ...dayNames.slice(0, todayIndex)];

    orderedDays.forEach(day => {
      const dayHours = props.hours.find(h => h.startsWith(day));
      if (dayHours) {
        const time = dayHours.replace(`${day}: `, '');
        const isToday = day === today;
        html += `
          <div class="popup-hours-row ${isToday ? 'today' : ''}">
            <span class="popup-hours-day">${day.slice(0, 3)}</span>
            <span>${time}</span>
          </div>
        `;
      }
    });

    html += `
        </div>
        <button class="popup-hours-toggle" onclick="document.getElementById('${popupId}').classList.toggle('expanded'); this.textContent = this.textContent === 'Show all hours' ? 'Hide hours' : 'Show all hours';">Show all hours</button>
      </div>
    `;
  }

  const tags = [
    ...(props.type || []),
    ...(props.cuisine || []),
    ...(props.goodFor || [])
  ].filter(Boolean);

  if (tags.length > 0) {
    html += '<div class="popup-tags">';
    tags.forEach(tag => {
      html += `<span class="popup-tag">${tag}</span>`;
    });
    html += '</div>';
  }

  if (props.notes && typeof props.notes === 'string' && props.notes.trim()) {
    html += `<div class="popup-notes">${props.notes}</div>`;
  }

  return html;
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
      marker.bindPopup(formatPopup(props), { maxWidth: 280 });
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

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }
}
