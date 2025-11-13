import express from 'express';
import { searchEventsWithPerplexity } from '../services/perplexityService.js';
import Event from '../models/Event.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { generateCacheKey, getCachedResult, setCachedResult, DEFAULT_TTL } from '../services/queryCache.js';

dotenv.config();

const router = express.Router();

/**
 * REMOVED: Web scraping functionality
 * System now uses only database + API queries
 */
async function searchEventsWithGeminiWebSearch_DISABLED(userQuery, targetDate = null) {
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
      "platform": "Platform name if known (Meetup, Luma, etc.)",
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

/**
 * Search events in MongoDB database
 */
async function searchEventsInDatabase(query, targetDate = null) {
  try {
    // Check if MongoDB is connected
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri || mongoUri.trim() === '') {
      console.log('⚠️ [DATA SOURCE: MONGODB] Database not configured - skipping database search');
      return [];
    }
    
    // Check mongoose connection state
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ [DATA SOURCE: MONGODB] Database not connected - skipping database search');
      return [];
    }
    
    console.log('🔍 [DATA SOURCE: MONGODB] Searching database...');
    
    // Build search criteria - prioritize date if provided
    let searchCriteria = { isActive: true };
    
    if (targetDate) {
      // If date is specified, search by date only (show all events for that date)
      const dateStr = new Date(targetDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      searchCriteria.date = { $regex: dateStr, $options: 'i' };
      console.log(`   → Searching for date: ${dateStr}`);
    } else {
      // If no date, search by keywords in name/description/category/location
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      const searchRegex = searchTerms.length > 0 ? searchTerms.join('|') : query;
      
      searchCriteria.$or = [
        { name: { $regex: searchRegex, $options: 'i' } },
        { description: { $regex: searchRegex, $options: 'i' } },
        { category: { $regex: searchRegex, $options: 'i' } },
        { location: { $regex: searchRegex, $options: 'i' } }
      ];
    }
    
    const events = await Event.find(searchCriteria)
      .sort({ date: 1 })
      .limit(50)
      .lean();
    
    console.log(`✅ [DATA SOURCE: MONGODB] Found ${events.length} events in database`);
    
    return events.map(e => ({
      name: e.name,
      time: e.time,
      location: e.location,
      description: e.description,
      link: e.link,
      price: e.price,
      platform: e.platform || e.source,
      source: e.source,
      category: e.category,
      date: e.date
    }));
  } catch (error) {
    console.error('❌ [DATA SOURCE: MONGODB] Search failed:', error.message);
    // Return empty array on error so the API can still work with other data sources
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
        lastActive: Date.now(),
        restaurantContext: null // Track restaurant search state
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

    const messageLower = message.toLowerCase();
    
    // Check if user is responding to a previous restaurant search (priority check)
    const isRestaurantFollowUp = session.restaurantContext && 
      (messageLower.includes('yes') || messageLower.includes('more') || 
       messageLower.includes('next') || messageLower.includes('show') ||
       messageLower.includes('rating') || messageLower.includes('price') ||
       messageLower.includes('cheap') || messageLower.includes('expensive') ||
       messageLower.includes('affordable') || messageLower.includes('inexpensive') ||
       messageLower.includes('no preference') || messageLower.includes('top') ||
       messageLower.includes('4.') || messageLower.includes('5.') || // rating numbers
       messageLower.includes('highly rated') || messageLower.includes('best') ||
       messageLower.includes('reviews') || messageLower.includes('location'));
    
    // Check if user is asking about restaurants (but not if it's a follow-up)
    const restaurantKeywords = ['restaurant', 'food', 'eat', 'dining', 'cuisine', 'dumplings', 'pizza', 
                                'sushi', 'burger', 'taco', 'ramen', 'pasta', 'steak', 'brunch', 'lunch', 
                                'dinner', 'breakfast', 'cafe', 'bakery', 'bar', 'hungry', 'thai', 'chinese',
                                'italian', 'japanese', 'korean', 'mexican', 'indian'];
    const isRestaurantQuery = !isRestaurantFollowUp && restaurantKeywords.some(keyword => messageLower.includes(keyword));
    
    // Check if user is asking about events (concerts, clubs, meetups, etc.)
    const eventKeywords = ['event', 'concert', 'club', 'meetup', 'party', 'show', 'gig', 'festival', 
                           'desi', 'bollywood', 'bhangra', 'tech', 'music', 'dance', 'nightlife',
                           'tonight', 'today', 'this weekend', 'happening', 'going on'];
    const isEventQuery = !isRestaurantQuery && !isRestaurantFollowUp && eventKeywords.some(keyword => messageLower.includes(keyword));

    let eventData = null; // Perplexity API response
    let dbEvents = null; // Events from database
    let restaurantData = null; // Restaurants from database
    let eventContext = '';
    let targetDate = null; // Declare outside block for caching access
    let cacheKey = null; // Cache key for event queries

    // Handle restaurant queries with conversational flow
    if (isRestaurantQuery || isRestaurantFollowUp) {
      console.log(isRestaurantFollowUp ? '🍽️ Restaurant follow-up detected' : '🍽️ Restaurant query detected');
      
      try {
        const { searchRestaurants } = await import('../services/restaurantService.js');
        
        // Cuisine keyword mapping
        const cuisineKeywords = {
          'chinese': 'Chinese', 'dumplings': 'Chinese', 'dim sum': 'Chinese',
          'italian': 'Italian', 'pizza': 'Pizza', 'pasta': 'Italian',
          'japanese': 'Japanese', 'sushi': 'Japanese', 'ramen': 'Japanese',
          'korean': 'Korean', 'mexican': 'Mexican', 'taco': 'Mexican',
          'indian': 'Indian', 'thai': 'Thai', 'vietnamese': 'Vietnamese',
          'american': 'American', 'burger': 'Hamburgers', 'steak': 'Steak',
          'french': 'French', 'mediterranean': 'Mediterranean', 'greek': 'Greek',
          'spanish': 'Spanish', 'caribbean': 'Caribbean', 'latin': 'Latin American',
          'middle eastern': 'Middle Eastern'
        };
        
        if (isRestaurantFollowUp && session.restaurantContext) {
          // User is responding to previous search
          const ctx = session.restaurantContext;
          
          // Detect intent from response
          if (messageLower.includes('yes') || messageLower.includes('more') || messageLower.includes('next')) {
            // Show next page
            ctx.page += 1;
          } else if (messageLower.includes('no preference') || messageLower.includes('top') || messageLower.includes('just show')) {
            // Show top 10 without filters
            ctx.page = 1;
            ctx.filters = {};
          } else {
            // Parse filters from user message
            ctx.page = 1; // Reset to page 1 when applying new filters
            
            // Extract rating (look for numbers like 4.5, 4, 5)
            const ratingMatch = message.match(/(\d+\.?\d*)\s*(star|rating)/i) || message.match(/(\d+\.?\d*)/);
            if (ratingMatch && (messageLower.includes('rating') || messageLower.includes('star') || messageLower.includes('highly rated') || messageLower.includes('best'))) {
              const rating = parseFloat(ratingMatch[1]);
              if (rating >= 1 && rating <= 5) {
                ctx.filters.minRating = rating;
                console.log(`   → Filter: minRating = ${rating}`);
              }
            } else if (messageLower.includes('highly rated') || messageLower.includes('best')) {
              ctx.filters.minRating = 4.5;
              console.log(`   → Filter: minRating = 4.5 (default for "highly rated")`);
            }
            
            // Extract price preference
            if (messageLower.includes('cheap') || messageLower.includes('affordable') || messageLower.includes('inexpensive') || 
                messageLower.includes('not much') || messageLower.includes('budget')) {
              ctx.filters.priceLevel = 'Inexpensive';
              console.log(`   → Filter: priceLevel = Inexpensive`);
            } else if (messageLower.includes('moderate') || messageLower.includes('mid-range') || messageLower.includes('medium')) {
              ctx.filters.priceLevel = 'Moderate';
              console.log(`   → Filter: priceLevel = Moderate`);
            } else if (messageLower.includes('expensive') || messageLower.includes('fancy') || messageLower.includes('upscale') || messageLower.includes('high-end')) {
              ctx.filters.priceLevel = 'Expensive';
              console.log(`   → Filter: priceLevel = Expensive`);
            }
          }
          
          // Search with updated filters
          const searchResult = await searchRestaurants({
            cuisine: ctx.cuisine,
            ...ctx.filters,
            page: ctx.page,
            limit: 10
          });
          
          restaurantData = searchResult.results;
          
          // Build context for AI
          const isFirstPage = ctx.page === 1;
          const hasFilters = Object.keys(ctx.filters).length > 0;
          
          const restaurantContext = searchResult.results
            .map((r, idx) => {
              const num = (ctx.page - 1) * 10 + idx + 1;
              return `RESTAURANT #${num}:\n` +
                `Name: ${r.Name || r.matchedName}\n` +
                `Rating: ${r.rating ? `${r.rating} stars` : 'N/A'}\n` +
                `Review Count: ${r.userRatingsTotal || 'N/A'}\n` +
                `Price Level: ${r.priceLevel || 'N/A'}\n` +
                `Cuisine: ${r.cuisineDescription || 'N/A'}\n` +
                `Address: ${r.matchedAddress || r.fullAddress}\n` +
                `${r.openingHours && r.openingHours.length > 0 ? `Hours: ${r.openingHours.slice(0, 3).join('; ')}\n` : ''}` +
                `${r.phoneNumber ? `Phone: ${r.phoneNumber}\n` : ''}` +
                `${r.website ? `Website URL: ${r.website}\n` : ''}` +
                `${r.googleMapsUri ? `Google Maps URL: ${r.googleMapsUri}\n` : ''}` +
                `${r.reviewSummary ? `\nREVIEW INSIGHTS (USE THIS!):\n${r.reviewSummary}\n` : '\nREVIEW INSIGHTS: None available\n'}`
            }).join('\n---\n\n');
          
          eventContext = `\n\n===== RESTAURANT RESULTS (Page ${ctx.page} of ${searchResult.totalPages}) =====\n` +
            `Total found: ${searchResult.totalCount} restaurants\n` +
            `Showing: ${(ctx.page - 1) * 10 + 1}-${(ctx.page - 1) * 10 + searchResult.results.length}\n` +
            `${hasFilters ? `Filters applied: ${JSON.stringify(ctx.filters)}\n` : ''}` +
            `\n${restaurantContext}\n\n` +
            `CRITICAL INSTRUCTIONS FOR RESTAURANT RECOMMENDATIONS:\n` +
            `${isFirstPage && !hasFilters ? '- This is the first page showing top-rated restaurants\n' : ''}` +
            `${hasFilters ? '- Filters have been applied based on user preference\n' : ''}` +
            `${searchResult.hasMore ? '- There are more results available. Ask if user wants to see more.\n' : '- This is the last page of results.\n'}` +
            `\n` +
            `HOW TO WRITE "💡 Why you should go" - CRITICAL RULES:\n` +
            `\n` +
            `🚨 CRITICAL REQUIREMENT - READ CAREFULLY:\n` +
            `\n` +
            `For EVERY restaurant, look at the "REVIEW INSIGHTS" section.\n` +
            `\n` +
            `IF REVIEW INSIGHTS EXISTS (not "None available"):\n` +
            `→ You MUST analyze and summarize what customers say\n` +
            `→ Extract key themes: atmosphere (cozy, elegant, romantic), food quality (authentic, fresh, handmade), service (friendly, attentive), specialties (specific dishes mentioned)\n` +
            `→ Write 2-3 sentences that capture these insights in your own words\n` +
            `→ Make it personal and specific - mention actual details from the reviews\n` +
            `\n` +
            `IF REVIEW INSIGHTS = "None available":\n` +
            `→ Write: "Highly rated with [X] reviews and [Y] stars - a trusted choice for [cuisine] dining!"\n` +
            `\n` +
            `❌ NEVER WRITE THESE GENERIC PHRASES:\n` +
            `- "popular choice for a reason"\n` +
            `- "great spot to try"\n` +
            `- "looks like a great place"\n` +
            `- "it's a popular choice"\n` +
            `\n` +
            `✅ EXAMPLE OF GOOD ANALYSIS:\n` +
            `REVIEW INSIGHTS: "Warm neighborhood restaurant and bar that presents seasonally driven Italian dishes from an open kitchen."\n` +
            `\n` +
            `YOUR OUTPUT: "With 710 reviews and a 4.8 rating, this warm neighborhood gem serves seasonally-driven Italian dishes from an open kitchen. Reviewers love the intimate, welcoming atmosphere and the fresh, creative menu that changes with the seasons. Perfect for a date night where you can watch the chefs at work!"\n` +
            `\n` +
            `ANOTHER EXAMPLE:\n` +
            `REVIEW INSIGHTS: "French-influenced Italian fixed-price menus. Elegant, vaulted interior with Tuscan touches."\n` +
            `\n` +
            `YOUR OUTPUT: "With 505 reviews and a 4.8 rating, Scalini Fedeli offers a unique French-Italian fusion experience with elegant fixed-price menus. Diners rave about the stunning vaulted interior with Tuscan touches that creates a romantic, upscale atmosphere. The sophisticated menu and beautiful setting make it perfect for special occasions!"\n` +
            `\n` +
            `YOUR JOB: Analyze the review insights and create a compelling, specific recommendation for each restaurant.\n` +
            `\n` +
            `OUTPUT FORMAT (FOLLOW EXACTLY):\n` +
            `For each restaurant, output in this EXACT format:\n` +
            `\n` +
            `[Number]. [Restaurant Name]\n` +
            `⭐ [Rating] stars ([Review Count] reviews)\n` +
            `💰 [Price Level]\n` +
            `🍽️ [Cuisine]\n` +
            `📍 [Address]\n` +
            `🕐 [Hours] (if available)\n` +
            `💡 Why you should go: [Your 2-3 sentence recommendation using REVIEW INSIGHTS]\n` +
            `🌐 [Website URL] (if available)\n` +
            `🔗 [Google Maps URL]\n` +
            `\n` +
            `CRITICAL:\n` +
            `- Use the EXACT emojis shown above\n` +
            `- Include ALL URLs exactly as provided (Website URL and Google Maps URL)\n` +
            `- Price Level must be the exact value from data (Inexpensive/Moderate/Expensive), not "N/A"\n` +
            `- "Why you should go" MUST use specific details from REVIEW INSIGHTS`;
          
        } else {
          // New restaurant search
          let detectedCuisine = null;
          for (const [keyword, cuisine] of Object.entries(cuisineKeywords)) {
            if (messageLower.includes(keyword)) {
              detectedCuisine = cuisine;
              break;
            }
          }
          
          console.log(`🔍 New restaurant search: cuisine="${detectedCuisine || 'any'}"`);
          
          // Initial search to get count
          const searchResult = await searchRestaurants({
            cuisine: detectedCuisine,
            limit: 10,
            page: 1
          });
          
          console.log(`✅ Found ${searchResult.totalCount} restaurants`);
          
          if (searchResult.totalCount === 0) {
            eventContext = `\n\n===== NO RESTAURANTS FOUND =====\nNo restaurants found for the query. Suggest the user try a different cuisine or be more specific.`;
            session.restaurantContext = null;
          } else {
            // Save context for follow-up
            session.restaurantContext = {
              cuisine: detectedCuisine,
              totalCount: searchResult.totalCount,
              page: 1,
              filters: {}
            };
            
            // Ask for preferences
            eventContext = `\n\n===== RESTAURANT SEARCH INITIATED =====\n` +
              `Total restaurants found: ${searchResult.totalCount}\n` +
              `Cuisine: ${detectedCuisine || 'Any'}\n\n` +
              `INSTRUCTIONS FOR YOUR RESPONSE:\n` +
              `1. Start with: "We found ${searchResult.totalCount} ${detectedCuisine || ''} restaurants in NYC! 🍽️"\n` +
              `2. Then say: "Want to narrow it down? I can filter by:"\n` +
              `3. List EXACTLY these 4 options (one per line, with emoji):\n` +
              `   ⭐ Rating (show highly-rated places)\n` +
              `   💰 Price (cheap, moderate, or fancy)\n` +
              `   📍 Location (specific neighborhood)\n` +
              `   👀 Reviews (most reviewed spots)\n` +
              `4. End with: "Or just say 'show me the top 10' and I'll give you the best ones!"\n` +
              `5. Keep it clean and simple - NO duplicate options\n` +
              `6. Be friendly but concise\n` +
              `7. Don't show any restaurant details yet - just ask for preference`;
          }
        }
        
      } catch (error) {
        console.error('❌ Restaurant search error:', error);
        session.restaurantContext = null;
      }
    } else {
      // Not a restaurant query - reset context
      if (session.restaurantContext) {
        console.log('🔄 Resetting restaurant context - topic changed');
        session.restaurantContext = null;
      }
    }

    // Use database + API approach only (NO web scraping)
    
    if (isEventQuery) {
      // Extract date from query if mentioned
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
      
      // Update cache key with target date (using the variable declared outside)
      cacheKey = generateCacheKey(message, targetDate);
      console.log(`🔍 Checking cache for event query...`);
      console.log(`   Query: "${message}"`);
      console.log(`   Cache key: ${cacheKey}`);
      console.log(`   Target date: ${targetDate ? targetDate.toISOString() : 'none'}`);
      
      // Check cache first (with similarity detection)
      let cachedResponse = null;
      try {
        cachedResponse = await getCachedResult(cacheKey, message);
      } catch (cacheError) {
        console.error('⚠️  [CACHE] Cache lookup failed:', cacheError.message);
        // Continue without cache - don't fail the request
      }
      
      if (cachedResponse) {
        console.log('✅ Cache HIT - Using cached response for query');
        console.log(`   Cached reply length: ${cachedResponse.reply?.length || 0} chars`);
        console.log(`   Cached citations: ${cachedResponse.citations?.length || 0}`);
        console.log(`   Cached DB events: ${cachedResponse.dbEvents?.length || 0}`);
        
        // Add user message to history (already done above)
        // Add cached AI response to history
        session.history.push({
          role: 'model',
          content: cachedResponse.reply
        });
        
        return res.json({
          reply: cachedResponse.reply,
          sessionId: sessionId,
          historyLength: session.history.length,
          citations: cachedResponse.citations || [],
          dbEvents: cachedResponse.dbEvents || [],
          cached: true // Flag to indicate this was served from cache
        });
      }
      
      console.log('💾 Cache MISS - fetching fresh data from APIs');
      
      // Search database and APIs only (NO web scraping)
      const searchPromises = [];
      
      // 1. Search MongoDB database FIRST
      searchPromises.push(
        (async () => {
          try {
            console.log('💾 [DATA SOURCE: MONGODB DATABASE] Searching stored events...');
            console.log(`   → Query: "${message}"`);
            console.log(`   → Target Date: ${targetDateStr}`);
            const events = await searchEventsInDatabase(message, targetDate);
            console.log(`✅ [DATA SOURCE: MONGODB DATABASE] Search complete`);
            console.log(`   → Found ${events.length} events`);
            if (events.length > 0) {
              console.log(`   → Sample events:`, events.slice(0, 2).map(e => e.name).join(', '));
              console.log(`   → Sources:`, [...new Set(events.map(e => e.source))].join(', '));
            }
            return { platform: 'Database', events };
          } catch (error) {
            console.error('❌ [DATA SOURCE: MONGODB DATABASE] Failed:', error.message);
            return null;
          }
        })()
      );
      
      // 2. Perplexity API for additional information
      if (process.env.PERPLEXITY_API_KEY) {
        searchPromises.push(
          (async () => {
            try {
              console.log('🔍 [DATA SOURCE: PERPLEXITY API] Starting API search...');
              console.log(`   → Query: "${message}"`);
              console.log(`   → Target Date: ${targetDateStr}`);
              const recentUserMessages = recentHistory
                .filter(msg => msg.role === 'user')
                .slice(-3)
                .map(msg => msg.content)
                .join('; ');
              
              const data = await searchEventsWithPerplexity(message, recentUserMessages);
              console.log(`✅ [DATA SOURCE: PERPLEXITY API] Search complete`);
              console.log(`   → Found ${data.citations?.length || 0} citation sources`);
              console.log(`   → Content length: ${data.content?.length || 0} characters`);
              if (data.citations && data.citations.length > 0) {
                console.log(`   → Citation URLs:`, data.citations.slice(0, 3).join(', '), data.citations.length > 3 ? '...' : '');
              }
              return { platform: 'Perplexity', data };
            } catch (error) {
              console.error('❌ [DATA SOURCE: PERPLEXITY API] Failed:', error.message);
              return null;
            }
          })()
        );
      } else {
        console.log('⚠️ [DATA SOURCE: PERPLEXITY API] Skipped - API key not configured');
      }
      
      // Run all searches in parallel
      console.log(`\n⚡ [PARALLEL EXECUTION] Running ${searchPromises.length} data source(s) simultaneously...`);
      const results = await Promise.allSettled(searchPromises);
      console.log(`✅ [PARALLEL EXECUTION] All searches completed\n`);
      
      // Combine results
      console.log('📦 [DATA AGGREGATION] Combining results from all sources...');
      dbEvents = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.platform === 'Perplexity') {
            // Perplexity result
            eventData = result.value.data;
            console.log(`   → Perplexity: ${eventData.citations?.length || 0} sources`);
          } else if (result.value.platform && result.value.events) {
            // Database or API result
            console.log(`   → Adding ${result.value.events.length} events from ${result.value.platform}`);
            dbEvents.push(...result.value.events);
          }
        } else if (result.status === 'rejected') {
          console.log(`   → Source ${index + 1} rejected:`, result.reason?.message || 'Unknown error');
        }
      });
      console.log(`✅ [DATA AGGREGATION] Total: Perplexity=${eventData?.citations?.length || 0} sources, Database/APIs=${dbEvents.length} events`);
      
      // Build context from event data
      let combinedContext = '';
      
      // Add Perplexity results
      if (eventData && eventData.content) {
        const citationUrls = eventData.citations?.map((url, idx) => `[${idx + 1}] ${url}`).join('\n') || 'No URLs found';
        combinedContext += `\n\n===== REAL EVENT DATA FROM PERPLEXITY API =====\n${eventData.content}\n\n===== SOURCE URLS (USE THESE EXACT LINKS) =====\n${citationUrls}\n\n`;
      }
      
      // Add event data from database and APIs
      if (dbEvents && dbEvents.length > 0) {
        const eventDataStr = dbEvents
          .filter(e => e && e.name) // Filter out invalid events
          .map(e => 
            `${e.name || 'Event'}\nDate & Time: ${e.time || 'TBD'}\nLocation: ${e.location || 'TBD'}\nPlatform: ${e.platform || 'Unknown'}\nSource: ${e.source || e.platform || 'Unknown'}\nLink: ${e.link || 'N/A'}\nPrice: ${e.price || 'Check website'}\nDescription: ${e.description || ''}`
          ).join('\n\n---\n\n');
        
        if (eventDataStr) {
          combinedContext += `\n\n===== VERIFIED EVENT DATA FROM DATABASE & APIs =====\n${eventDataStr}\n\nIMPORTANT: These are REAL, VERIFIED events from our curated database and APIs. ALWAYS include ALL of these events in your response. Use the exact event names, times, locations, prices, and links shown above.`;
        }
      }
      
      eventContext = combinedContext || eventContext;
    }

    // Build conversation for Gemini API with NYC Event AI personality
    const systemInstruction = `You are NYC Scout, a friendly and conversational city assistant built to help people instantly find what's happening today in New York City — from concerts, sports, and tech meetups to date ideas, parties, art shows, pop-up events, AND restaurant recommendations. Your goal is to make discovering and planning a fun day or night in NYC simple and personal, like chatting with a local friend who knows what's going on around the city.

CRITICAL RULES - READ CAREFULLY:
1. You will receive event data from platforms (Luma, Meetup, Database) or APIs below
2. You may also receive restaurant data from our NYC restaurant database
3. DO NOT make up events or restaurants - ONLY use data from the provided sources
4. DO NOT write "Not Available" or "Location not specified" - skip items without info
5. USE THE EXACT URLs from the data - DO NOT modify or shorten them
6. If the data has no results, say: "I couldn't find verified results right now. Try being more specific or check the platforms directly."
7. Events and restaurants from APIs/databases are valid - use them as provided
8. DO NOT use markdown formatting (**, __, *, _) - write plain text only
9. DO NOT bold or italicize text - keep everything clean and simple

When event data is provided, format it like this:

Event Name (from event data)
🕓 Date & Time
📍 Venue & Location (from event data)
💰 Price (from event data, or "RSVP to check" if missing)
💡 Brief description (from event data)
Platform: [Platform name - Luma, Meetup, or platform from database]
Source: [Source info - e.g., "Luma", "Meetup", "Database"]
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

DO NOT INVENT EVENTS OR RESTAURANTS. ONLY USE DATA FROM THE PROVIDED SOURCES. ONLY USE URLs FROM THE DATA.

When restaurant data is provided, YOU MUST:
1. Review ALL the restaurant data carefully (ratings, reviews, summaries, cuisine)
2. Add your own personality and recommendations - explain WHY someone should go
3. Highlight what makes each place special based on the data (high ratings, great reviews, unique cuisine)
4. Use the review summaries to add context and flavor
5. Be conversational and enthusiastic - you're recommending places you'd actually go to

Format restaurants like this:

Restaurant Name
⭐ Rating (X stars, Y reviews)
💰 Price Level (Inexpensive/Moderate/Expensive)
🍽️ Cuisine Type
📍 Address
💡 Why you should go: [Add your recommendation based on ratings, reviews, and summary - be specific and enthusiastic!]
📞 Phone (if available)
🔗 Website or Google Maps link

Example:
Joe's Shanghai
⭐ 4.2 stars (1,234 reviews)
💰 Moderate
🍽️ Chinese (Dumplings, Dim Sum)
📍 9 Pell St, Chinatown, Manhattan
💡 Why you should go: This place is legendary for their soup dumplings - seriously some of the best in Chinatown. With over 1,200 reviews and a solid 4.2 rating, locals and tourists alike swear by it. The xiao long bao are juicy and flavorful, and the prices won't break the bank. Perfect spot if you're craving authentic Chinese comfort food!
📞 (212) 233-8888
🔗 https://maps.google.com/...

IMPORTANT FOR RESTAURANTS:
- Always read the review summaries and ratings provided in the data
- Use that information to craft personalized, enthusiastic recommendations
- Explain what makes each restaurant special (cuisine style, atmosphere, signature dishes)
- If ratings are high (4.0+), emphasize that - "highly rated", "crowd favorite", "local gem"
- If there's a review summary, incorporate insights from it into your recommendation
- Make it feel like you're a friend who's actually been there and loved it

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
    if (eventData) {
      console.log('📊 Using real event data from Perplexity API');
    }
    if (dbEvents && dbEvents.length > 0) {
      console.log(`📊 Using real event data: ${dbEvents.length} events from database/APIs`);
    }
    console.log('🤖 Asking Gemini to format response...');

    // Validate contents array
    if (!contents || contents.length === 0) {
      throw new Error('No conversation content to send to Gemini');
    }

    // Call Gemini API
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;
    
    const body = { contents };

    let apiRes;
    try {
      apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (fetchError) {
      console.error('❌ Failed to fetch from Gemini API:', fetchError.message);
      throw new Error(`Failed to connect to Gemini API: ${fetchError.message}`);
    }

    let data;
    try {
      data = await apiRes.json();
    } catch (jsonError) {
      const errorText = await apiRes.text().catch(() => 'Unable to read response');
      console.error('❌ Failed to parse Gemini API response:', errorText);
      throw new Error(`Invalid response from Gemini API: ${jsonError.message}`);
    }
    
    // Check for API errors
    if (!apiRes.ok) {
      console.error('❌ Gemini API error:', data);
      throw new Error(`Gemini API error: ${data.error?.message || apiRes.statusText || 'Unknown error'}`);
    }
    
    if (!data.candidates || !data.candidates[0]) {
      console.error('❌ No response from Gemini:', data);
      throw new Error('No response from Gemini API');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      console.error('❌ Invalid response structure from Gemini:', data);
      throw new Error('Invalid response structure from Gemini API');
    }

    const reply = candidate.content.parts[0].text;
    
    if (!reply) {
      console.error('❌ Empty reply from Gemini:', data);
      throw new Error('Empty reply from Gemini API');
    }
    
    console.log('✅ Got response from Gemini');

    // Add AI response to history
    session.history.push({
      role: 'model',
      content: reply
    });

    const responseData = {
      reply: reply.trim(),
      sessionId: sessionId,
      historyLength: session.history.length,
      citations: eventData?.citations || [], // Include citations from Perplexity
      dbEvents: dbEvents || [], // Include events from database and APIs
      restaurants: restaurantData || [] // Include restaurants from database
    };
    
    // Cache the response if it's an event query
    if (isEventQuery) {
      // Generate cache key if not already set (fallback)
      if (!cacheKey) {
        cacheKey = generateCacheKey(message, targetDate);
        console.log(`📝 Generated cache key: ${cacheKey}`);
      }
      
      // Always cache event queries, even if targetDate is null (use message-only key)
      if (cacheKey) {
        console.log(`💾 Caching response for event query...`);
        console.log(`   Cache key: ${cacheKey}`);
        console.log(`   Target date: ${targetDate ? targetDate.toISOString() : 'none'}`);
        console.log(`   Reply length: ${reply.trim().length} chars`);
        console.log(`   Citations: ${eventData?.citations?.length || 0}`);
        console.log(`   DB events: ${dbEvents?.length || 0}`);
        
        try {
          await setCachedResult(cacheKey, {
            reply: reply.trim(),
            citations: eventData?.citations || [],
            dbEvents: dbEvents || [],
            eventData: eventData ? { content: eventData.content, citations: eventData.citations } : null
          }, DEFAULT_TTL, message); // Pass original message for similarity matching
          console.log(`✅ Response cached successfully`);
        } catch (cacheError) {
          console.error(`⚠️  [CACHE] Failed to cache response:`, cacheError.message);
          console.error(`   Cache operations will fail until Redis is configured and running`);
          // Don't fail the request if caching fails
        }
      } else {
        console.log(`⚠️  Skipping cache - no cache key available`);
      }
    } else {
      console.log(`ℹ️  Not caching - not an event query`);
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error in chat endpoint:', error.message);
    console.error('❌ Full error:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      error: 'Failed to process message',
      reply: "Sorry, I'm having trouble right now. Please try again!",
      debug: error.message
    });
  }
});

export default router;

