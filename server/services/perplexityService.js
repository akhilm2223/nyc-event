import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_MODEL = 'sonar'; // Working model confirmed
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Search for events using Perplexity API
 * @param {string} query - User's event search query
 * @param {string} context - Optional conversation context
 * @returns {Promise<Object>} - Event data with citations
 */
export async function searchEventsWithPerplexity(query, context = '') {
  try {
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

        // Build system prompt for NYC Event AI - focused search based on user query
        const systemPrompt = `You are Event AI, a NYC event discovery assistant.

SEARCH INSTRUCTIONS:
- Search ONLY for what the user asked for (e.g., if they ask "tech meetups in Brooklyn", search ONLY for tech meetups in Brooklyn, not all events)
- IMPORTANT: If user says "play" or "to play" or "games to play", they want PARTICIPATORY events (pickup games, sports leagues, activities they can join), NOT spectator events (concerts, shows, games to watch)
  * "football games to play" = pickup soccer/football games, sports leagues, recreational games
  * "football games to watch" or just "football games" = NFL games, professional sports to attend as spectator
- Search across these platforms ONLY:
  * Luma: https://luma.com/nyc
  * Eventbrite: https://eventbrite.com
  * Meetup: https://meetup.com
  * GoodRec: https://www.goodrec.com/pickup-soccer/new-york-city (for pickup soccer games in NYC)
    - IMPORTANT: GoodRec loads all game listings with JavaScript - individual games are NOT in the raw HTML
    - Game cards like "9 v 9 CO-ED Pickup Soccer In Bushwick Inlet" load dynamically after page render
    - Perplexity cannot see these dynamic listings - you'll only get summaries, not individual game details
    - ALWAYS mention: "Also check GoodRec's NYC page (https://www.goodrec.com/pickup-soccer/new-york-city) for daily pickup soccer games. These games are dynamically updated and can be joined via the GoodRec app."
    - Do NOT try to extract individual game names/times - they're not accessible via web scraping
    - Include the main GoodRec URL and explain that registration is via the GoodRec app
  * Dice.fm and Resident Advisor (for music events)

CRITICAL: Only search for events that match the user's specific query. Do NOT search for everything if they ask for something specific.
CRITICAL: For GoodRec, understand that game listings are dynamically loaded with JavaScript and are NOT accessible via web scraping. Always mention that GoodRec has daily pickup soccer games available through their app, and include the main URL: https://www.goodrec.com/pickup-soccer/new-york-city

FOR EACH EVENT YOU FIND, ALWAYS RETURN:
1. Event name
2. Date & time (exact format: "Wednesday, Nov 5, 2025 at 6:30 PM")
3. Location (venue name and neighborhood/address)
4. Platform (which site it's from: Luma, Eventbrite, Meetup, GoodRec, Dice.fm, or Resident Advisor)
5. Source (format: "[Platform] (Web Search)" - e.g., "Luma (Web Search)", "Eventbrite (Web Search)", "Meetup (Web Search)")
6. Direct event link (the specific registration/ticket URL, NOT just the main platform page)
7. Short description (if available on the event page)

FORMAT EACH EVENT LIKE THIS:
Event Name
Date & Time: [exact date and time]
Location: [venue, neighborhood/address]
Platform: [Luma/Eventbrite/Meetup/GoodRec/Dice.fm/Resident Advisor]
Link: [direct event registration URL]
Description: [brief description if available]

RULES:
- DO NOT list events without direct event links
- DO NOT search for everything if user asks for something specific
- Extract EXACT times - if page says "5:30 PM", use "5:30 PM"
- Use SPECIFIC event page URLs, not generic platform pages
- For GoodRec: Understand that game listings are dynamically loaded with JavaScript and individual games are NOT accessible via web scraping
- ALWAYS mention: "Also check GoodRec's NYC page (https://www.goodrec.com/pickup-soccer/new-york-city) for daily pickup soccer games. These games are dynamically updated and can be joined via the GoodRec app."
- Use the main GoodRec URL (https://www.goodrec.com/pickup-soccer/new-york-city) and always note that registration is via the GoodRec app
- Do NOT try to extract individual game names/times - they're not in the raw HTML and can't be scraped
- If no events match the query, say "No events found matching [user's query]. Try checking [platform] directly."
- IMPORTANT: If the page shows games for a specific date but user asks for a different date, note that the page shows games for [date] and suggest checking the app for [user's requested date]`;

        // Ensure query includes NYC if location not specified
        const queryLower = query.toLowerCase();
        const hasLocation = queryLower.includes('nyc') || queryLower.includes('new york') || 
                           queryLower.includes('brooklyn') || queryLower.includes('manhattan') ||
                           queryLower.includes('queens') || queryLower.includes('bronx') ||
                           queryLower.includes('soho') || queryLower.includes('dumbo') ||
                           queryLower.includes('bushwick') || queryLower.includes('williamsburg');
        
        const enhancedQuery = hasLocation ? query : `in NYC ${query}`;
        
        // Always include platform URLs when searching NYC events
        const lumaNYCUrl = 'https://luma.com/nyc';
        const goodRecNYCUrl = 'https://www.goodrec.com/pickup-soccer/new-york-city';
        const platformUrls = `Include results from: ${lumaNYCUrl}, Eventbrite.com, Meetup.com, ${goodRecNYCUrl} (for pickup soccer games), Dice.fm`;
        
        const userQuery = context 
          ? `${platformUrls}\n\n${context}\n\nUser now asks: ${enhancedQuery}`
          : `${platformUrls}\n\n${enhancedQuery}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ];

    console.log('🔍 Searching Perplexity for:', query);

    const response = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Perplexity API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('No response from Perplexity API');
    }

    const content = data.choices[0].message.content;
    const citations = data.citations || [];

    console.log(`✅ Perplexity found ${citations.length} sources`);

    return {
      content: content,
      citations: citations,
      model: PERPLEXITY_MODEL
    };

  } catch (error) {
    console.error('❌ Perplexity API error:', error.message);
    throw error;
  }
}

/**
 * Search for events with a specific focus (concerts, meetups, etc.)
 * @param {string} eventType - Type of event (concerts, tech meetups, etc.)
 * @param {string} location - Location/neighborhood (optional)
 * @param {string} timeFrame - Time frame (tonight, today, this weekend, etc.)
 * @returns {Promise<Object>} - Event data
 */
export async function searchSpecificEvents(eventType, location = 'NYC', timeFrame = 'tonight') {
  const query = `Find ${eventType} in ${location} ${timeFrame}. Include event name, time, location, and description.`;
  return await searchEventsWithPerplexity(query);
}

