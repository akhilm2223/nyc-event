import express from 'express';
import { parseUserIntent, formatEventResponse, searchEventsWithAI } from '../services/geminiService.js';
import { searchEventsWithPerplexity } from '../services/perplexityService.js';
import { searchEventbriteEvents } from '../services/eventbriteService.js';
import { scrapeGoodRecEvents, scrapeLumaEvents } from '../services/dynamicScraperService.js';
import fetch from 'node-fetch';

const router = express.Router();

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

    let eventData = null;
    let eventbriteEvents = null;
    let dynamicEvents = null; // Events from Puppeteer scraping
    let perplexityContext = '';

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
      
      // Check if query mentions GoodRec or pickup soccer/football
      const queryLower = message.toLowerCase();
      const explicitlyGoodRec = queryLower.includes('goodrec');
      const explicitlyLuma = queryLower.includes('luma');
      
      // If user explicitly asks for a platform, only use that platform
      // Otherwise, use smart detection
      const needsGoodRec = explicitlyGoodRec || 
                          (!explicitlyLuma && (queryLower.includes('football') || queryLower.includes('soccer') || 
                          queryLower.includes('sport') || queryLower.includes('play') ||
                          queryLower.includes('pickup')));
      const needsLuma = explicitlyLuma || 
                       (!explicitlyGoodRec && !queryLower.includes('football') && !queryLower.includes('soccer') && 
                        !queryLower.includes('pickup') && !queryLower.includes('sport'));
      
      // HYBRID APPROACH: Use both Perplexity and Puppeteer
      const searchPromises = [];
      
      // 1. Perplexity for indexable platforms (Meetup, Eventbrite, general search)
      if (process.env.PERPLEXITY_API_KEY) {
        searchPromises.push(
          (async () => {
            try {
              console.log('🔍 [Hybrid] Searching Perplexity for indexable platforms...');
              const recentUserMessages = recentHistory
                .filter(msg => msg.role === 'user')
                .slice(-3)
                .map(msg => msg.content)
                .join('; ');
              
              eventData = await searchEventsWithPerplexity(message, recentUserMessages);
              console.log(`✅ [Hybrid] Perplexity found ${eventData.citations?.length || 0} sources`);
              return eventData;
            } catch (error) {
              console.error('⚠️ [Hybrid] Perplexity failed:', error.message);
              return null;
            }
          })()
        );
      }
      
      // 2. Puppeteer + Gemini for dynamic platforms (GoodRec, Luma)
      if (needsGoodRec || needsLuma) {
        if (needsGoodRec) {
          searchPromises.push(
            (async () => {
              try {
                console.log('🌐 [Hybrid] Scraping GoodRec with Puppeteer...');
                const goodRecEvents = await scrapeGoodRecEvents(targetDateStr);
                console.log(`✅ [Hybrid] GoodRec scraping found ${goodRecEvents.length} events`);
                return { platform: 'GoodRec', events: goodRecEvents };
              } catch (error) {
                console.error('⚠️ [Hybrid] GoodRec scraping failed:', error.message);
                return null;
              }
            })()
          );
        }
        
        if (needsLuma) {
          searchPromises.push(
            (async () => {
              try {
                console.log('🌐 [Hybrid] Scraping Luma with Puppeteer...');
                const lumaEvents = await scrapeLumaEvents(targetDateStr);
                console.log(`✅ [Hybrid] Luma scraping found ${lumaEvents.length} events`);
                return { platform: 'Luma', events: lumaEvents };
              } catch (error) {
                console.error('⚠️ [Hybrid] Luma scraping failed:', error.message);
                return null;
              }
            })()
          );
        }
      }
      
      // Run all searches in parallel
      const results = await Promise.allSettled(searchPromises);
      
      // Combine results
      dynamicEvents = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.platform) {
            // Puppeteer result
            dynamicEvents.push(...result.value.events);
          }
        }
      });
      
      // Build context from all sources
      let combinedContext = '';
      
      // Add Perplexity results
      if (eventData) {
        const citationUrls = eventData.citations?.map((url, idx) => `[${idx + 1}] ${url}`).join('\n') || 'No URLs found';
        combinedContext += `\n\n===== REAL EVENT DATA FROM PERPLEXITY API (indexable platforms: Eventbrite.com, Meetup, etc.) =====\n${eventData.content}\n\n===== SOURCE URLS (USE THESE EXACT LINKS) =====\n${citationUrls}\n\n`;
      }
      
      // Add Puppeteer results
      if (dynamicEvents && dynamicEvents.length > 0) {
        const dynamicData = dynamicEvents.map(e => 
          `${e.name}\nDate & Time: ${e.time || 'TBD'}\nLocation: ${e.location || 'TBD'}\nPlatform: ${e.platform}\nLink: ${e.link}\nDescription: ${e.description || ''}`
        ).join('\n\n---\n\n');
        
        combinedContext += `\n\n===== REAL EVENT DATA FROM PUPPETEER SCRAPING (dynamic platforms: GoodRec, Luma) =====\n${dynamicData}\n\nIMPORTANT: These events were extracted from dynamically loaded pages. Use the exact event names, times, locations, and links shown above.`;
      }
      
      perplexityContext = combinedContext || perplexityContext;
      
      console.log(`✅ [Hybrid] Total events found: Perplexity=${eventData?.citations?.length || 0} sources, Puppeteer=${dynamicEvents.length} events`);
    }

    // Build conversation for Gemini API with NYC Event AI personality
    const systemInstruction = `You are NYC Event AI, a friendly and conversational city assistant built to help people instantly find what's happening today in New York City — from concerts, sports, and tech meetups to date ideas, parties, art shows, and pop-up events. Your goal is to make discovering and planning a fun day or night in NYC simple and personal, like chatting with a local friend who knows what's going on around the city.

CRITICAL RULES - READ CAREFULLY:
1. You will receive event data from Perplexity API below with SOURCE URLS
2. DO NOT make up events - ONLY use events from the Perplexity data
3. DO NOT write "Not Available" or "Location not specified" - skip events without info
4. USE THE EXACT URLs from the "SOURCE URLS" section - DO NOT modify or shorten them
5. If Perplexity data has no events or no URLs, say: "I couldn't find verified events right now. Try being more specific or check Eventbrite/Luma directly."

When Perplexity provides event data, format it like this:

Event Name (from Perplexity data)
🕓 Date & Time (from Perplexity data)
📍 Venue & Location (from Perplexity data)
💰 Price (from Perplexity data, or "RSVP to check" if missing)
💡 Brief description (from Perplexity data)
🔗 [EXACT URL from SOURCE URLS list]

Example - if Perplexity says "AI Meetup at WeWork on Nov 5" with source URL https://lu.ma/ai-meetup:
AI Meetup
🕓 Nov 5, 6:30 PM
📍 WeWork Bryant Park, Midtown
💰 Free
💡 Network with AI engineers and founders
🔗 https://lu.ma/ai-meetup

DO NOT INVENT EVENTS. ONLY USE DATA FROM PERPLEXITY. ONLY USE URLs FROM SOURCE URLS LIST.

Always prioritize showing today's or tonight's events unless the user asks for another date. If real event data is provided, use it directly. If no events exactly match, offer close alternatives or similar experiences. 

Always talk in a friendly, modern tone — relaxed, human, and slightly Gen Z but not robotic or over-excited. Think like a local NYC friend giving quick, confident suggestions: "Here's what's popping off tonight 🔥 Want something more chill or more party vibes?"

You should remember what users have shown interest in — such as music, food, nightlife, or tech — and use that context in later responses. If the user is vague, ask casual follow-ups like "You looking for something chill or high energy tonight?" or "Wanna stay in Manhattan or explore Brooklyn?"

Focus on quality over quantity — never show past events or raw data. Don't use phrases like "I can help you find," just directly show what's happening. If the user sounds like they want a full plan, offer to combine dinner spots or activities around the events.

Your tone should always feel personal, urban, and friendly — like you actually live in NYC and know what's going on. You are not just a search engine — you're a companion that helps plan real experiences in the city, using up-to-date event data from APIs and web sources.

Remember the conversation history and build on what the user has asked before.${perplexityContext}`;

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
      console.log('📊 Using real event data from Perplexity');
    }
    console.log('🤖 Asking Gemini to format response...');

    // Call Gemini API
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    
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
      eventbriteEvents: eventbriteEvents || [], // Include Eventbrite events
      dynamicEvents: dynamicEvents || [] // Include events from Puppeteer scraping (GoodRec, Luma)
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

