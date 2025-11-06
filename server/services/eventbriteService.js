import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Support both EVENTBRITE_API_KEY and EVENTBRITE_TOKEN
const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY || process.env.EVENTBRITE_TOKEN;
const EVENTBRITE_BASE_URL = 'https://www.eventbriteapi.com/v3';

/**
 * Search for events on Eventbrite
 * 
 * NOTE: Eventbrite's /v3/events/search/ endpoint requires OAuth application access,
 * not Personal Token access. Personal Tokens can only access user-owned events.
 * 
 * For public event search, we recommend using Perplexity API which can search
 * Eventbrite's public website and extract events.
 * 
 * @param {string} query - Search term (e.g., "music", "tech meetup")
 * @param {string} location - Location (e.g., "New York, NY")
 * @param {string} startDate - ISO date string (e.g., "2025-11-05T00:00:00")
 * @param {number} limit - Number of results (default: 10)
 * @returns {Promise<Array>} - Array of normalized event objects
 */
export async function searchEventbriteEvents(query, location = 'New York, NY', startDate = null, limit = 10) {
  try {
    if (!EVENTBRITE_API_KEY) {
      throw new Error('EVENTBRITE_API_KEY not configured');
    }

    // NOTE: The /events/search/ endpoint requires OAuth app, not Personal Token
    // Personal Tokens can only access events the user owns
    // This function will throw an error - use Perplexity API for public event search instead
    console.warn('⚠️ Eventbrite Personal Token does not support public event search.');
    console.warn('⚠️ Use Perplexity API which can search Eventbrite.com public website.');
    throw new Error('Eventbrite Personal Token does not have access to public event search. Use Perplexity API instead.');

    // Build query parameters
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (location) params.append('location.address', location);
    if (startDate) {
      params.append('start_date.range_start', startDate);
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0];
      params.append('start_date.range_start', `${today}T00:00:00`);
    }
    params.append('sort_by', 'date');
    params.append('expand', 'venue,ticket_availability');
    params.append('status', 'live');

    // Build URL - Add token as query parameter (Eventbrite supports both token in URL and Bearer)
    params.append('token', EVENTBRITE_API_KEY);
    // Try without trailing slash - Eventbrite API might not like it
    const url = `${EVENTBRITE_BASE_URL}/events/search?${params.toString()}`;

    console.log('🎫 Searching Eventbrite for:', query, 'in', location);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error_description || errorData.error || errorData.message || JSON.stringify(errorData);
        console.error('📛 Full error response:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        const text = await response.text();
        console.error('📛 Error response text:', text);
      }
      throw new Error(`Eventbrite API error: ${errorMessage} (Status: ${response.status})`);
    }

    const data = await response.json();

    if (!data.events || data.events.length === 0) {
      console.log('📭 No events found on Eventbrite');
      return [];
    }

    console.log(`✅ Found ${data.events.length} events on Eventbrite`);

    // Normalize Eventbrite events to our format
    return data.events.slice(0, limit).map(event => normalizeEventbriteEvent(event));

  } catch (error) {
    console.error('❌ Eventbrite API error:', error.message);
    throw error;
  }
}

/**
 * Normalize Eventbrite event data to our format
 * @param {Object} event - Raw Eventbrite event object
 * @returns {Object} - Normalized event object
 */
function normalizeEventbriteEvent(event) {
  const startDate = event.start?.utc || event.start?.local || null;
  const endDate = event.end?.utc || event.end?.local || null;
  
  // Format date/time
  let dateTime = '';
  if (startDate) {
    const date = new Date(startDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      dateTime = `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateTime = `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      dateTime = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    }
  }

  // Get venue location
  let location = '';
  if (event.venue) {
    const venue = event.venue;
    location = `${venue.name || ''}${venue.address?.localized_address_display ? ', ' + venue.address.localized_address_display.split(',')[0] : ''}`.trim();
  } else if (event.online_event) {
    location = 'Online Event';
  }

  // Get price
  let price = 'RSVP to check';
  if (event.ticket_availability) {
    if (event.ticket_availability.is_free) {
      price = 'Free';
    } else if (event.ticket_availability.minimum_ticket_price) {
      const minPrice = event.ticket_availability.minimum_ticket_price;
      const maxPrice = event.ticket_availability.maximum_ticket_price;
      if (minPrice && maxPrice && minPrice.value !== maxPrice.value) {
        price = `$${minPrice.value}-${maxPrice.value}`;
      } else if (minPrice) {
        price = `$${minPrice.value}`;
      }
    }
  }

  return {
    name: event.name?.text || event.title || 'Untitled Event',
    time: dateTime || 'TBD',
    location: location || 'Location TBD',
    price: price,
    description: event.description?.text ? 
      event.description.text.substring(0, 200).replace(/<[^>]*>/g, '') + '...' : 
      'Check event page for details',
    link: event.url || `https://www.eventbrite.com/e/${event.id}`,
    source: 'Eventbrite',
    id: event.id,
    category: event.category_id
  };
}

/**
 * Get event by ID
 * @param {string} eventId - Eventbrite event ID
 * @returns {Promise<Object>} - Normalized event object
 */
export async function getEventbriteEvent(eventId) {
  try {
    if (!EVENTBRITE_API_KEY) {
      throw new Error('EVENTBRITE_API_KEY not configured');
    }

    const url = `${EVENTBRITE_BASE_URL}/events/${eventId}/?expand=venue,ticket_availability`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${EVENTBRITE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Eventbrite API error: ${response.statusText}`);
    }

    const event = await response.json();
    return normalizeEventbriteEvent(event);

  } catch (error) {
    console.error('❌ Eventbrite API error:', error.message);
    throw error;
  }
}

