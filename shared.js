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

    // Add open-now prefix if active
    if (filterState.openNow) {
      parts.push('open-now');
    }

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

  // ===== HOURS PARSING & OPEN STATUS =====

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CLOSING_SOON_MINUTES = 45;

  /**
   * Parse a time string like "9:00 AM", "9:00 PM", "9:00" into minutes from midnight.
   * Handles missing AM/PM by inferring from context.
   */
  function parseTime(timeStr, isEndTime = false, startMinutes = null) {
    if (!timeStr) return null;

    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();

    // Convert to 24-hour format based on AM/PM
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    } else if (!period) {
      hours = inferHour(hours, minutes, isEndTime, startMinutes);
    }

    return hours * 60 + minutes;
  }

  /**
   * Infer whether an hour without AM/PM should be treated as PM.
   * For end times: must be after start time.
   * For start times: hours 1-6 are assumed PM (afternoon openings).
   */
  function inferHour(hours, minutes, isEndTime, startMinutes) {
    if (!isEndTime || startMinutes === null) {
      // Start times: assume PM for typical afternoon hours (1-6)
      return (hours >= 1 && hours <= 6) ? hours + 12 : hours;
    }

    // End times: ensure result is after start time
    const startHour = Math.floor(startMinutes / 60);
    const currentMinutes = hours * 60 + minutes;

    // If start was PM and this hour < 12, assume PM
    if (hours < 12 && startHour >= 12) {
      return hours + 12;
    }
    // If result would be before start, assume PM
    if (currentMinutes < startMinutes && hours < 12) {
      return hours + 12;
    }
    return hours;
  }

  /**
   * Parse a time range string like "9:00 AM – 5:00 PM" or "4:00 – 9:00 PM"
   * Returns array of { start, end } objects (in minutes from midnight)
   * Handles multiple periods separated by commas
   */
  function parseTimeRange(rangeStr) {
    if (!rangeStr || rangeStr === 'Closed') return null;
    if (rangeStr.includes('Open 24 hours')) return [{ start: 0, end: 1440, is24h: true }];

    // Split on comma for multiple periods (e.g., "11:00 AM – 3:00 PM, 5:00 – 10:00 PM")
    const periods = rangeStr.split(',').map(s => s.trim());
    const results = [];

    for (const period of periods) {
      // Split on en-dash, em-dash, or hyphen
      const parts = period.split(/\s*[–—-]\s*/);
      if (parts.length !== 2) continue;

      const startMinutes = parseTime(parts[0], false, null);
      const endMinutes = parseTime(parts[1], true, startMinutes);

      if (startMinutes === null || endMinutes === null) continue;

      results.push({ start: startMinutes, end: endMinutes });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Get today's hours entry from hours array
   */
  function getTodayHours(hours, date = new Date()) {
    if (!Array.isArray(hours) || hours.length === 0) return null;

    const dayName = DAY_NAMES[date.getDay()];
    const entry = hours.find(h => h && h.startsWith(dayName + ':'));

    if (!entry) return null;

    const timeStr = entry.replace(`${dayName}: `, '');
    return { dayName, timeStr, ranges: parseTimeRange(timeStr) };
  }

  /**
   * Check if a place is currently open
   * Returns: { isOpen, isClosingSoon, closesAt, opensAt, status }
   * status: 'open' | 'closing-soon' | 'closed' | 'unknown'
   */
  function getOpenStatus(hours, date = new Date()) {
    const todayData = getTodayHours(hours, date);

    if (!todayData || !todayData.ranges) {
      return { isOpen: false, isClosingSoon: false, status: 'unknown' };
    }

    const currentMinutes = date.getHours() * 60 + date.getMinutes();

    for (const range of todayData.ranges) {
      if (range.is24h) {
        return { isOpen: true, isClosingSoon: false, status: 'open', todayHours: todayData.timeStr };
      }

      const openResult = checkTimeRange(range, currentMinutes, todayData.timeStr);
      if (openResult) return openResult;
    }

    // Closed - find next opening time
    return {
      isOpen: false,
      isClosingSoon: false,
      status: 'closed',
      opensAt: findNextOpenTime(hours, date),
      todayHours: todayData.timeStr
    };
  }

  /**
   * Check if current time falls within a time range.
   * Returns open status object if in range, null if not.
   */
  function checkTimeRange(range, currentMinutes, todayHours) {
    const { start, end } = range;
    const wrapsToNextDay = end < start;

    let isInRange, minutesUntilClose;

    if (wrapsToNextDay) {
      // Open if after start OR before end (next day)
      isInRange = currentMinutes >= start || currentMinutes < end;
      minutesUntilClose = currentMinutes >= start
        ? (1440 - currentMinutes) + end  // After start, wraps to tomorrow
        : end - currentMinutes;           // Early morning, before end
    } else {
      isInRange = currentMinutes >= start && currentMinutes < end;
      minutesUntilClose = end - currentMinutes;
    }

    if (!isInRange) return null;

    const isClosingSoon = minutesUntilClose <= CLOSING_SOON_MINUTES && minutesUntilClose > 0;
    return {
      isOpen: true,
      isClosingSoon,
      minutesUntilClose,
      closesAt: formatMinutesAsTime(end % 1440),
      status: isClosingSoon ? 'closing-soon' : 'open',
      todayHours
    };
  }

  /**
   * Find when the place next opens
   */
  function findNextOpenTime(hours, date = new Date()) {
    if (!Array.isArray(hours) || hours.length === 0) return null;

    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const currentDayIndex = date.getDay();

    // Check if there's a later opening today
    const todayData = getTodayHours(hours, date);
    if (todayData && todayData.ranges) {
      for (const range of todayData.ranges) {
        if (range.start > currentMinutes) {
          return `today at ${formatMinutesAsTime(range.start)}`;
        }
      }
    }

    // Check tomorrow and following days
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(date);
      checkDate.setDate(checkDate.getDate() + i);
      const dayData = getTodayHours(hours, checkDate);

      if (dayData && dayData.ranges && dayData.ranges.length > 0) {
        const dayLabel = i === 1 ? 'tomorrow' : DAY_NAMES[checkDate.getDay()];
        return `${dayLabel} at ${formatMinutesAsTime(dayData.ranges[0].start)}`;
      }
    }

    return null;
  }

  /**
   * Format minutes from midnight as time string (e.g., 540 -> "9:00 AM")
   */
  function formatMinutesAsTime(minutes) {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  }

  // ===== EXPOSE AS GLOBAL =====

  window.PlacesConfig = {
    statusColors,
    categoryIcons,
    primaryIcons,
    slugify,
    getPlaceIcon,
    formatWebsiteDisplay,
    encodeFilterHash,
    // Hours parsing
    DAY_NAMES,
    CLOSING_SOON_MINUTES,
    parseTime,
    parseTimeRange,
    getTodayHours,
    getOpenStatus,
    findNextOpenTime,
    formatMinutesAsTime
  };

})();
