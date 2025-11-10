import express from 'express';
import { searchEventsWithPerplexity } from '../services/perplexityService.js';
import { searchEventbriteEvents } from '../services/eventbriteService.js';
import { scrapeGoodRecEvents, scrapeLumaEvents, scrapeMeetupEvents } from '../services/dynamicScraperService.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * Search for events using Gemini with web search enabled
 * This is used as a fallback when no events are found from scrapers
 */
async function searchEventsWithGeminiWebSearch(userQuery, targetDate = null) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Build search query with date if provided
    let searchQuery = userQuery;
    if (targetDate) {
      const dateStr = new Date(targetDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      searchQuery = `${userQuery} on ${dateStr} in New York City`;
    } else {
      searchQuery = `${userQuery} in New York City`;
    }

    const prompt = `Search the web for real, upcoming events in New York City matching this query: "${searchQuery}"

Find actual events with:
- Event name
- Date and time (specific date and time)
- Venue/location (specific venue name and neighborhood)
- Brief description
- Direct event link/URL (registration or ticket URL)

Focus on events from platforms like:
- Eventbrite
- Meetup
- Luma
- Dice.fm
- Resident Advisor
- Venue websites
- Event listing sites

Return the events in JSON format with this exact structure:
{
  "events": [
    {
      "name": "Event Name",
      "time": "Date and time (e.g., 'Friday, November 7, 2025 at 6:30 PM')",
      "location": "Venue name and neighborhood (e.g., 'WeWork Bryant Park, Midtown')",
      "link": "Direct event URL",
      "description": "Brief description",
      "platform": "Platform name if known (Eventbrite, Meetup, etc.)",
      "source": "Web Search"
    }
  ]
}

Only include real, verified events that are actually happening. If you can't find any events, return {"events": []}.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Event name' },
                  time: { type: 'string', description: 'Date and time' },
                  location: { type: 'string', description: 'Venue and location' },
                  link: { type: 'string', description: 'Direct event URL' },
                  description: { type: 'string', description: 'Brief description', nullable: true },
                  platform: { type: 'string', description: 'Platform name', nullable: true },
                  source: { type: 'string', description: 'Source identifier' }
                },
                required: ['name', 'time', 'location', 'link', 'source']
              }
            }
          },
          required: ['events']
        }
      }
    };

    // Enable web search/grounding for Gemini 2.0 Flash
    // Add googleSearchRetrieval tool to enable web search
    requestBody.tools = [{
      googleSearchRetrieval: {}
    }];

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      console.error('No response from Gemini web search');
      return [];
    }

    // Parse JSON response
    const extractedText = data.candidates[0].content.parts[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini web search JSON response:', parseError);
      console.log('Raw response:', extractedText);
      return [];
    }

    const events = (parsedData.events || []).map(event => ({
      name: event.name,
      platform: event.platform || 'Web Search',
      source: event.source || 'Web Search',
      link: event.link,
      time: event.time,
      location: event.location,
      description: event.description || null,
      price: null
    }));

    return events;

  } catch (error) {
    console.error('Error in Gemini web search:', error);
    return [];
  }
}

// Store conversation history per session (in-memory for now)
// Key: sessionId, Value: array of messages
const conversationSessions = new Map();

// Clean up old sessions after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, session] of conversationSessions.entries()) {
    if (session.lastActive < oneHourAgo) {
      conversationSessions.delete(sessionId);
    }
  }
}, 30 * 60 * 1000); // Check every 30 minutes

/**
 * POST /api/chat - Handle chat messages
 * This is the user-facing chat endpoint (not Instagram webhooks)
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`\n💬 Chat message received: "${message}" (Session: ${sessionId})`);

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured');
      return res.json({
        reply: "Oops! The AI isn't configured yet. Please add GEMINI_API_KEY to the .env file."
      });
    }

    // Get or create conversation history for this session
    if (!conversationSessions.has(sessionId)) {
      conversationSessions.set(sessionId, {
        history: [],
        lastActive: Date.now()
      });
    }

    const session = conversationSessions.get(sessionId);
    session.lastActive = Date.now();

    // Add user message to history
    session.history.push({
      role: 'user',
      content: message
    });

    // Keep only last 5 messages (10 total with responses)
    const recentHistory = session.history.slice(-10);

    // Check if user is asking about events (concerts, clubs, meetups, etc.)
    const eventKeywords = ['event', 'concert', 'club', 'meetup', 'party', 'show', 'gig', 'festival', 
                           'desi', 'bollywood', 'bhangra', 'tech', 'music', 'dance', 'nightlife',
                           'tonight', 'today', 'this weekend', 'happening', 'going on', 'find', 'search'];
    const messageLower = message.toLowerCase();
    const isEventQuery = eventKeywords.some(keyword => messageLower.includes(keyword));

    let eventData = null; // Perplexity API response
    let eventbriteEvents = null;
    let dynamicEvents = null; // Events from Puppeteer scraping
    let eventContext = '';

    // If user is asking about events, use web scraping approach:
    // Puppeteer + Gemini for dynamic platforms (GoodRec, Luma, Meetup)
    
    // COMMENTED OUT: Previous Perplexity search approach
    // If user is asking about events, use HYBRID approach:
    // 1. Perplexity for indexable platforms (Meetup, Eventbrite)
    // 2. Puppeteer + Gemini for dynamic platforms (GoodRec, Luma)
    
    if (isEventQuery) {
      // Extract date from query if mentioned
      let targetDate = null;
      let targetDateStr = null;
      
      const messageLower = message.toLowerCase();
      const today = new Date();
      
      // Try to parse specific date formats first (e.g., "August 7, 2025", "Aug 7 2025", "8/7/2025")
      const datePatterns = [
        /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
        /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/
      ];
      
      let parsedSpecificDate = null;
      for (const pattern of datePatterns) {
        const match = message.match(pattern);
        if (match) {
          try {
            if (pattern === datePatterns[0] || pattern === datePatterns[1]) {
              // Full month name or abbreviation
              const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                                 'july', 'august', 'september', 'october', 'november', 'december'];
              const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const monthName = match[1].toLowerCase();
              let monthIndex = monthNames.indexOf(monthName);
              if (monthIndex === -1) {
                monthIndex = monthAbbr.indexOf(monthName);
              }
              if (monthIndex !== -1) {
                const day = parseInt(match[2]);
                const year = parseInt(match[3]);
                parsedSpecificDate = new Date(year, monthIndex, day);
              }
            } else if (pattern === datePatterns[2]) {
              // MM/DD/YYYY
              const month = parseInt(match[1]) - 1;
              const day = parseInt(match[2]);
              const year = parseInt(match[3]);
              parsedSpecificDate = new Date(year, month, day);
            } else if (pattern === datePatterns[3]) {
              // YYYY-MM-DD
              const year = parseInt(match[1]);
              const month = parseInt(match[2]) - 1;
              const day = parseInt(match[3]);
              parsedSpecificDate = new Date(year, month, day);
            }
            
            if (parsedSpecificDate && !isNaN(parsedSpecificDate.getTime())) {
              console.log(`📅 Parsed specific date from query: ${parsedSpecificDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
              break;
            }
          } catch (e) {
            // Continue to next pattern
          }
        }
      }
      
      // Parse date keywords or use parsed specific date
      if (parsedSpecificDate && !isNaN(parsedSpecificDate.getTime())) {
        targetDate = parsedSpecificDate;
      } else if (messageLower.includes('tomorrow') || messageLower.includes('tomo')) {
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 1);
      } else if (messageLower.includes('today')) {
        targetDate = new Date(today);
      } else if (messageLower.includes('sunday')) {
        // Find next Sunday
        targetDate = new Date(today);
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysUntilSunday = dayOfWeek === 0 ? 7 : (7 - dayOfWeek); // If today is Sunday, get next Sunday (7 days), otherwise get coming Sunday
        targetDate.setDate(today.getDate() + daysUntilSunday);
      } else if (messageLower.includes('monday')) {
        targetDate = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
        targetDate.setDate(today.getDate() + daysUntilMonday);
      } else if (messageLower.includes('tuesday')) {
        targetDate = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilTuesday = dayOfWeek === 2 ? 7 : (9 - dayOfWeek) % 7;
        targetDate.setDate(today.getDate() + daysUntilTuesday);
      } else if (messageLower.includes('wednesday')) {
        targetDate = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilWednesday = dayOfWeek === 3 ? 7 : (10 - dayOfWeek) % 7;
        targetDate.setDate(today.getDate() + daysUntilWednesday);
      } else if (messageLower.includes('thursday')) {
        targetDate = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilThursday = dayOfWeek === 4 ? 7 : (11 - dayOfWeek) % 7;
        targetDate.setDate(today.getDate() + daysUntilThursday);
      } else if (messageLower.includes('friday')) {
        targetDate = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilFriday = dayOfWeek === 5 ? 7 : (12 - dayOfWeek) % 7;
        targetDate.setDate(today.getDate() + daysUntilFriday);
      } else if (messageLower.includes('saturday')) {
        targetDate = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilSaturday = dayOfWeek === 6 ? 7 : (13 - dayOfWeek) % 7;
        targetDate.setDate(today.getDate() + daysUntilSaturday);
      } else {
        // Default to tomorrow if no date specified
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 1);
      }
      
      targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log(`📅 Target date detected: ${targetDateStr} (${targetDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`);
      
      // Check if query mentions GoodRec or pickup soccer/football/volleyball
      const queryLower = message.toLowerCase();
      const explicitlyGoodRec = queryLower.includes('goodrec');
      const explicitlyLuma = queryLower.includes('luma');
      const isVolleyball = queryLower.includes('volleyball') || queryLower.includes('volley');
      
      // If user explicitly asks for a platform, only use that platform
      // Otherwise, use smart detection
      const needsGoodRec = explicitlyGoodRec || 
                          (!explicitlyLuma && !isVolleyball && (queryLower.includes('football') || queryLower.includes('soccer') || 
                          (queryLower.includes('sport') && !queryLower.includes('volleyball')) || 
                          (queryLower.includes('play') && !queryLower.includes('volleyball')) ||
                          (queryLower.includes('pickup') && !queryLower.includes('volleyball'))));
      const needsGoodRecVolleyball = isVolleyball || (explicitlyGoodRec && queryLower.includes('volleyball'));
      const needsLuma = explicitlyLuma || 
                       (!explicitlyGoodRec && !isVolleyball && !queryLower.includes('football') && !queryLower.includes('soccer') && 
                        !queryLower.includes('pickup') && !queryLower.includes('sport'));
      
      // Search ALL primary platforms: Perplexity, Eventbrite, GoodRec, Luma, Meetup
      const searchPromises = [];
      
      // 1. Perplexity API for web search (Eventbrite, Meetup, general events)
      if (process.env.PERPLEXITY_API_KEY) {
        searchPromises.push(
          (async () => {
            try {
              console.log('🔍 [DATA SOURCE: PERPLEXITY API] Starting web search...');
              console.log(`   → Query: "${message}"`);
              console.log(`   → Target Date: ${targetDateStr}`);
              const recentUserMessages = recentHistory
                .filter(msg => msg.role === 'user')
                .slice(-3)
                .map(msg => msg.content)
                .join('; ');
              
              eventData = await searchEventsWithPerplexity(message, recentUserMessages);
              console.log(`✅ [DATA SOURCE: PERPLEXITY API] Search complete`);
              console.log(`   → Found ${eventData.citations?.length || 0} citation sources`);
              console.log(`   → Content length: ${eventData.content?.length || 0} characters`);
              if (eventData.citations && eventData.citations.length > 0) {
                console.log(`   → Citation URLs:`, eventData.citations.slice(0, 3).join(', '), eventData.citations.length > 3 ? '...' : '');
              }
              return { platform: 'Perplexity', data: eventData };
            } catch (error) {
              console.error('❌ [DATA SOURCE: PERPLEXITY API] Failed:', error.message);
              return null;
            }
          })()
        );
      } else {
        console.log('⚠️ [DATA SOURCE: PERPLEXITY API] Skipped - API key not configured');
      }
      
      // 1. Eventbrite API
      if (process.env.EVENTBRITE_API_KEY) {
        searchPromises.push(
          (async () => {
            try {
              console.log('🎫 [DATA SOURCE: EVENTBRITE API] Starting search...');
              console.log(`   → Target Date: ${targetDateStr}`);
              const eventbriteResults = await searchEventbriteEvents(message, targetDateStr);
              console.log(`✅ [DATA SOURCE: EVENTBRITE API] Search complete`);
              console.log(`   → Found ${eventbriteResults.length} events`);
              if (eventbriteResults.length > 0) {
                console.log(`   → Sample events:`, eventbriteResults.slice(0, 2).map(e => e.name).join(', '));
              }
              return { platform: 'Eventbrite', events: eventbriteResults };
            } catch (error) {
              console.error('❌ [DATA SOURCE: EVENTBRITE API] Failed:', error.message);
              return null;
            }
          })()
        );
      } else {
        console.log('⚠️ [DATA SOURCE: EVENTBRITE API] Skipped - API key not configured');
      }
      
      // 2. GoodRec scraper (always search unless Luma is explicitly requested)
      if (!explicitlyLuma) {
        searchPromises.push(
          (async () => {
            try {
              console.log('🌐 [DATA SOURCE: GOODREC SCRAPER] Starting Puppeteer scraping...');
              console.log(`   → Target Date: ${targetDateStr}`);
              console.log(`   → Reason: ${explicitlyGoodRec ? 'Explicitly requested' : 'Auto-search (all platforms)'}`);
              const goodRecEvents = await scrapeGoodRecEvents(targetDateStr);
              console.log(`✅ [DATA SOURCE: GOODREC SCRAPER] Scraping complete`);
              console.log(`   → Found ${goodRecEvents.length} events`);
              if (goodRecEvents.length > 0) {
                console.log(`   → Sample events:`, goodRecEvents.slice(0, 2).map(e => e.name).join(', '));
                console.log(`   → All events have platform: ${goodRecEvents.every(e => e.platform === 'GoodRec')}`);
                console.log(`   → Source tracking: ${goodRecEvents[0].source || 'Not set'}`);
              }
              return { platform: 'GoodRec', events: goodRecEvents };
            } catch (error) {
              console.error('❌ [DATA SOURCE: GOODREC SCRAPER] Failed:', error.message);
              return null;
            }
          })()
        );
      }
      
      // 3. Luma scraper (always search unless GoodRec is explicitly requested)
      if (!explicitlyGoodRec) {
        searchPromises.push(
          (async () => {
            try {
              console.log('🌐 [DATA SOURCE: LUMA SCRAPER] Starting Puppeteer scraping...');
              console.log(`   → Target Date: ${targetDateStr}`);
              console.log(`   → Reason: ${explicitlyLuma ? 'Explicitly requested' : 'Auto-search (all platforms)'}`);
              const lumaEvents = await scrapeLumaEvents(targetDateStr);
              console.log(`✅ [DATA SOURCE: LUMA SCRAPER] Scraping complete`);
              console.log(`   → Found ${lumaEvents.length} events`);
              if (lumaEvents.length > 0) {
                console.log(`   → Sample events:`, lumaEvents.slice(0, 2).map(e => e.name).join(', '));
                console.log(`   → All events have platform: ${lumaEvents.every(e => e.platform === 'Luma')}`);
                console.log(`   → Source tracking: ${lumaEvents[0].source || 'Not set'}`);
              }
              return { platform: 'Luma', events: lumaEvents };
            } catch (error) {
              console.error('❌ [DATA SOURCE: LUMA SCRAPER] Failed:', error.message);
              return null;
            }
          })()
        );
      }
      
      // 4. Meetup scraper (always search all platforms)
      searchPromises.push(
        (async () => {
          try {
            console.log('🌐 [DATA SOURCE: MEETUP SCRAPER] Starting Puppeteer scraping...');
            console.log(`   → Target Date: ${targetDateStr}`);
            const meetupEvents = await scrapeMeetupEvents(targetDateStr);
            console.log(`✅ [DATA SOURCE: MEETUP SCRAPER] Scraping complete`);
            console.log(`   → Found ${meetupEvents.length} events`);
            if (meetupEvents.length > 0) {
              console.log(`   → Sample events:`, meetupEvents.slice(0, 2).map(e => e.name).join(', '));
              console.log(`   → Source tracking: ${meetupEvents[0].source || 'Not set'}`);
            }
            return { platform: 'Meetup', events: meetupEvents };
          } catch (error) {
            console.error('❌ [DATA SOURCE: MEETUP SCRAPER] Failed:', error.message);
            return null;
          }
        })()
      );
      
      // Run all searches in parallel
      console.log(`\n⚡ [PARALLEL EXECUTION] Running ${searchPromises.length} data source(s) simultaneously...`);
      const results = await Promise.allSettled(searchPromises);
      console.log(`✅ [PARALLEL EXECUTION] All searches completed\n`);
      
      // Combine results
      console.log('📦 [DATA AGGREGATION] Combining results from all sources...');
      dynamicEvents = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.platform === 'Perplexity') {
            // Perplexity result
            eventData = result.value.data;
            console.log(`   → Perplexity: ${eventData.citations?.length || 0} sources`);
          } else if (result.value.platform && result.value.events) {
            // Scraper result
            console.log(`   → Adding ${result.value.events.length} events from ${result.value.platform}`);
            dynamicEvents.push(...result.value.events);
          }
        } else if (result.status === 'rejected') {
          console.log(`   → Source ${index + 1} rejected:`, result.reason?.message || 'Unknown error');
        }
      });
      console.log(`✅ [DATA AGGREGATION] Total: Perplexity=${eventData?.citations?.length || 0} sources, Scrapers=${dynamicEvents.length} events`);
      
      // Build context from event data
      let combinedContext = '';
      
      // Add Perplexity results
      if (eventData) {
        const citationUrls = eventData.citations?.map((url, idx) => `[${idx + 1}] ${url}`).join('\n') || 'No URLs found';
        combinedContext += `\n\n===== REAL EVENT DATA FROM PERPLEXITY WEB SEARCH (Eventbrite, Meetup, venues, etc.) =====\n${eventData.content}\n\n===== SOURCE URLS (USE THESE EXACT LINKS) =====\n${citationUrls}\n\n`;
      }
      
      // Add event data from scrapers
      if (dynamicEvents && dynamicEvents.length > 0) {
        const dynamicData = dynamicEvents.map(e => 
          `${e.name}\nDate & Time: ${e.time || 'TBD'}\nLocation: ${e.location || 'TBD'}\nPlatform: ${e.platform}\nSource: ${e.source || e.platform}\nLink: ${e.link}\nDescription: ${e.description || ''}`
        ).join('\n\n---\n\n');
        
        combinedContext += `\n\n===== REAL EVENT DATA FROM SCRAPERS (GoodRec, Luma, Meetup) =====\n${dynamicData}\n\nIMPORTANT: These events were extracted from real platforms. Use the exact event names, times, locations, platforms, sources, and links shown above.`;
      }
      
      eventContext = combinedContext || eventContext;
      
      // If no events found from scrapers, use Gemini web search as fallback
      if (!dynamicEvents || dynamicEvents.length === 0) {
        console.log('🔍 No events found from scrapers, using Gemini web search...');
        try {
          const webSearchEvents = await searchEventsWithGeminiWebSearch(message, targetDateStr);
          if (webSearchEvents && webSearchEvents.length > 0) {
            console.log(`✅ Found ${webSearchEvents.length} events from Gemini web search`);
            
            // Format web search events for context
            const webSearchData = webSearchEvents.map(e => 
              `${e.name}\nDate & Time: ${e.time || 'TBD'}\nLocation: ${e.location || 'TBD'}\nPlatform: ${e.platform || 'Web Search'}\nSource: ${e.source || 'Web Search'}\nLink: ${e.link}\nDescription: ${e.description || ''}`
            ).join('\n\n---\n\n');
            
            combinedContext += `\n\n===== EVENT DATA FROM WEB SEARCH =====\n${webSearchData}\n\nIMPORTANT: These events were found via web search. Use the exact event names, times, locations, and links shown above.`;
            eventContext = combinedContext;
            dynamicEvents = webSearchEvents; // Add to dynamicEvents for response
          }
        } catch (error) {
          console.error('❌ Error in Gemini web search:', error.message);
        }
      }
    }

    // Build conversation for Gemini API with NYC Event AI personality
    const systemInstruction = `You are NYC Event AI, a friendly and conversational city assistant built to help people instantly find what's happening today in New York City — from concerts, sports, and tech meetups to date ideas, parties, art shows, and pop-up events. Your goal is to make discovering and planning a fun day or night in NYC simple and personal, like chatting with a local friend who knows what's going on around the city.

CRITICAL RULES - READ CAREFULLY:
1. You will receive event data from platforms (Eventbrite, GoodRec, Luma, Meetup) or web search below
2. DO NOT make up events - ONLY use events from the provided data
3. DO NOT write "Not Available" or "Location not specified" - skip events without info
4. USE THE EXACT URLs from the event data - DO NOT modify or shorten them
5. If the data has no events, say: "I couldn't find verified events right now. Try being more specific or check the platforms directly."
6. Events from web search are also valid - use them just like events from platforms

When event data is provided, format it like this:

Event Name (from event data)
🕓 Date & Time
📍 Venue & Location (from event data)
💰 Price (from event data, or "RSVP to check" if missing)
💡 Brief description (from event data)
Platform: [Platform name - Eventbrite, GoodRec, Luma, Meetup, or platform from web search]
Source: [Source info - e.g., "Eventbrite", "GoodRec", "Luma", "Meetup", "Web Search"]
🔗 [EXACT URL from event data]

Example - if event data shows "AI Meetup at WeWork on Nov 5" with source URL https://lu.ma/ai-meetup:
AI Meetup
🕓 Nov 5, 6:30 PM
📍 WeWork Bryant Park, Midtown
💰 Free
💡 Network with AI engineers and founders
Platform: Luma
Source: Luma
🔗 https://lu.ma/ai-meetup

DO NOT INVENT EVENTS. ONLY USE DATA FROM THE PROVIDED SOURCES. ONLY USE URLs FROM THE EVENT DATA.

Always prioritize showing today's or tonight's events unless the user asks for another date. If real event data is provided, use it directly. If no events exactly match, offer close alternatives or similar experiences. 

Always talk in a friendly, modern tone — relaxed, human, and slightly Gen Z but not robotic or over-excited. Think like a local NYC friend giving quick, confident suggestions: "Here's what's popping off tonight 🔥 Want something more chill or more party vibes?"

You should remember what users have shown interest in — such as music, food, nightlife, or tech — and use that context in later responses. If the user is vague, ask casual follow-ups like "You looking for something chill or high energy tonight?" or "Wanna stay in Manhattan or explore Brooklyn?"

Focus on quality over quantity — never show past events or raw data. Don't use phrases like "I can help you find," just directly show what's happening. If the user sounds like they want a full plan, offer to combine dinner spots or activities around the events.

Your tone should always feel personal, urban, and friendly — like you actually live in NYC and know what's going on. You are not just a search engine — you're a companion that helps plan real experiences in the city, using up-to-date event data from APIs and web sources.

Remember the conversation history and build on what the user has asked before.${eventContext}`;

    // Convert to Gemini API format
    const contents = [];
    
    // Build conversation with history
    if (recentHistory.length === 1) {
      contents.push({
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nUser: ${recentHistory[0].content}` }]
      });
    } else {
      // Add system instruction to first user message
      const firstUserMsg = recentHistory.find(msg => msg.role === 'user');
      if (firstUserMsg) {
        contents.push({
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nUser: ${firstUserMsg.content}` }]
        });
      }
      
      // Add rest of conversation
      recentHistory.forEach((msg, index) => {
        const firstUserIndex = recentHistory.findIndex(m => m.role === 'user');
        if (index !== firstUserIndex || msg.role !== 'user') {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          });
        }
      });
    }

    console.log(`🧠 Context: ${recentHistory.length} messages in history`);
    // COMMENTED OUT: Perplexity logging
    // if (eventData) {
    //   console.log('📊 Using real event data from Perplexity');
    // }
    if (dynamicEvents && dynamicEvents.length > 0) {
      console.log(`📊 Using real event data: ${dynamicEvents.length} events`);
    }
    console.log('🤖 Asking Gemini to format response...');

    // Call Gemini API
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;
    
    const body = { contents };

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await apiRes.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    const reply = data.candidates[0].content.parts[0].text;
    
    console.log('✅ Got response from Gemini');

    // Add AI response to history
    session.history.push({
      role: 'model',
      content: reply
    });

    res.json({
      reply: reply.trim(),
      sessionId: sessionId,
      historyLength: session.history.length,
      citations: eventData?.citations || [], // Include citations from Perplexity
      dynamicEvents: dynamicEvents || [] // Include events from scrapers (GoodRec, Luma, Meetup)
    });

  } catch (error) {
    console.error('❌ Error in chat endpoint:', error.message);
    res.status(500).json({
      error: 'Failed to process message',
      reply: "Sorry, I'm having trouble right now. Please try again!"
    });
  }
});

export default router;

