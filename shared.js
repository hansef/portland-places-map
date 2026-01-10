/**
 * Shared configuration and utilities for Portland Places Map
 *
 * This file is the single source of truth for config objects and utility
 * functions. It exposes everything via window.PlacesConfig for use by:
 * - Inline scripts in index.html (for Alpine store registration)
 * - ES modules like app.js (which access window.PlacesConfig)
 *
 * LOAD ORDER: This file MUST be loaded as a classic <script> (not module)
 * BEFORE the inline Alpine script, so that window.PlacesConfig is available
 * synchronously.
 */

(function() {
  'use strict';

  // ===== CONFIGURATION =====

  const statusColors = {
    'haunts': '#4a7c59',
    'queue': '#6b8cae',
    'unknown': '#9ca3a3'
  };

  const categoryIcons = {
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

  const primaryIcons = {
    'coffee': 'fa-mug-hot',
    'bar': 'fa-martini-glass',
    'restaurant': 'fa-utensils'
  };

  // ===== PURE UTILITY FUNCTIONS =====

  /**
   * Convert a place name to URL-safe slug
   */
  function slugify(name) {
    return name
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get icon class for a place based on category and primary type
   */
  function getPlaceIcon(category, primary) {
    if (category === 'Food & Drink' && primary && primaryIcons[primary]) {
      return primaryIcons[primary];
    }
    return categoryIcons[category] || 'fa-location-dot';
  }

  /**
   * Format website URL for display (extract social media handles, etc.)
   */
  function formatWebsiteDisplay(url) {
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
   * Encode filter state to URL hash
   */
  function encodeFilterHash(filterState) {
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

  // ===== EXPOSE AS GLOBAL =====

  window.PlacesConfig = {
    statusColors,
    categoryIcons,
    primaryIcons,
    slugify,
    getPlaceIcon,
    formatWebsiteDisplay,
    encodeFilterHash
  };

})();
