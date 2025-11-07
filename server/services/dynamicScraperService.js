import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Scrape GoodRec page using Puppeteer and extract events with Gemini
 * @param {string} date - Date to search for (optional, format: "YYYY-MM-DD")
 * @returns {Promise<Array>} - Array of extracted events
 */
export async function scrapeGoodRecEvents(date = null) {
  let browser = null;
  try {
    console.log('🌐 Launching Puppeteer to scrape GoodRec...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to GoodRec NYC page
    const url = 'https://www.goodrec.com/pickup-soccer/new-york-city';
    console.log('📄 Loading:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for game cards to load (they're dynamically loaded)
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give time for JavaScript to render
    
    // Get the full HTML after JavaScript execution
    const html = await page.content();
    
    // Extract text content that might contain game info
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('✅ Page loaded, extracting events with Gemini...');
    
    // Use Gemini to extract events from the scraped content
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    // Format date for prompt
    let dateFilter = '';
    let dateFormats = [];
    if (date) {
      const targetDate = new Date(date);
      dateFormats = [
        targetDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), // "Sunday, November 9, 2025"
        targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), // "November 9, 2025"
        date // "2025-11-09"
      ];
      dateFilter = `\n\nCRITICAL: Only extract games that match ONE of these date formats: ${dateFormats.join(', ')}. Skip all other dates.`;
    }
    
    const prompt = `Extract all pickup soccer games from this GoodRec NYC page content. 
    
Page content:
${pageText.substring(0, 5000)}${dateFilter}

${date && dateFormats.length > 0 ? `IMPORTANT: Only extract games for ${dateFormats[0]}. Skip all other dates.` : 'Extract all games found.'}

For each game, extract:
- name: Event name (e.g., "9 v 9 CO-ED Pickup Soccer In Bushwick Inlet")
- time: Date and time combined (e.g., "Friday, August 1, 2025 at 09:00 AM")
- location: Location (e.g., "Bushwick Inlet, Williamsburg")
- format: Format (9v9, 11v11, etc.) if mentioned
- description: Brief description (e.g., "9v9 pickup soccer game")`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
                    time: { type: 'string', description: 'Date and time combined' },
                    location: { type: 'string', description: 'Location/venue' },
                    format: { type: 'string', description: 'Game format (9v9, 11v11, etc.)', nullable: true },
                    description: { type: 'string', description: 'Brief description' }
                  },
                  required: ['name', 'time', 'location']
                }
              }
            },
            required: ['events']
          }
        }
      })
    });
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    // Parse JSON response directly
    const extractedText = data.candidates[0].content.parts[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON response:', parseError);
      console.log('Raw response:', extractedText);
      return [];
    }
    
    console.log('✅ Events extracted from GoodRec');
    
    // Convert to event objects with consistent structure
    const events = (parsedData.events || []).map(event => ({
      name: event.name,
      platform: 'GoodRec',
      source: 'GoodRec (Scraped)',
      link: url,
      time: event.time,
      location: event.location,
      description: event.description || (event.format ? `${event.format} pickup soccer game` : 'Pickup soccer game'),
      format: event.format || null,
      price: null
    }));
    
    if (events.length > 0) {
      console.log(`   → Parsed ${events.length} events with source: ${events[0].source}`);
    }
    return events;
    
  } catch (error) {
    console.error('❌ Error scraping GoodRec:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape Luma NYC page using Puppeteer and extract events with Gemini
 * @param {string} date - Date to search for (optional)
 * @returns {Promise<Array>} - Array of extracted events
 */
export async function scrapeLumaEvents(date = null) {
  let browser = null;
  try {
    console.log('🌐 Launching Puppeteer to scrape Luma...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const url = 'https://luma.com/nyc';
    console.log('📄 Loading:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for events to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get page text
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('✅ Page loaded, extracting events with Gemini...');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    // Format date for prompt
    let dateFilter = '';
    let dateFormats = [];
    if (date) {
      const targetDate = new Date(date);
      dateFormats = [
        targetDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), // "Sunday, November 9, 2025"
        targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), // "November 9, 2025"
        date // "2025-11-09"
      ];
      dateFilter = `\n\nCRITICAL: Only extract events that match ONE of these date formats: ${dateFormats.join(', ')}. Skip all other dates.`;
    }
    
    const prompt = `Extract all events from this Luma NYC page content.

Page content:
${pageText.substring(0, 5000)}${dateFilter}

${date && dateFormats.length > 0 ? `IMPORTANT: Only extract events for ${dateFormats[0]}. Skip all other dates.` : 'Extract all events found.'}

For each event, extract:
- name: Event name
- time: Date and time combined (e.g., "Friday, November 7, 2025 at 5:30 PM")
- location: Venue name and neighborhood
- price: Price if mentioned, or null
- link: Direct event URL if available in the content, or null
- description: Brief description if available`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
                    time: { type: 'string', description: 'Date and time combined' },
                    location: { type: 'string', description: 'Venue and neighborhood' },
                    price: { type: 'string', description: 'Price if mentioned', nullable: true },
                    link: { type: 'string', description: 'Direct event URL', nullable: true },
                    description: { type: 'string', description: 'Brief description', nullable: true }
                  },
                  required: ['name', 'time', 'location']
                }
              }
            },
            required: ['events']
          }
        }
      })
    });
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    // Parse JSON response directly
    const extractedText = data.candidates[0].content.parts[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON response:', parseError);
      console.log('Raw response:', extractedText);
      return [];
    }
    
    console.log('✅ Events extracted from Luma');
    
    // Convert to event objects with consistent structure
    const events = (parsedData.events || []).map(event => ({
      name: event.name,
      platform: 'Luma',
      source: 'Luma (Scraped)',
      link: event.link && event.link.startsWith('http') ? event.link : url,
      time: event.time,
      location: event.location,
      description: event.description || null,
      price: event.price || null
    }));
    
    if (events.length > 0) {
      console.log(`   → Parsed ${events.length} events with source: ${events[0].source}`);
    }
    return events;
    
  } catch (error) {
    console.error('❌ Error scraping Luma:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape Meetup.com NYC page using Puppeteer and extract events with Gemini
 * @param {string} date - Date to search for (optional, format: "YYYY-MM-DD")
 * @returns {Promise<Array>} - Array of extracted events
 */
export async function scrapeMeetupEvents(date = null) {
  let browser = null;
  try {
    console.log('🌐 Launching Puppeteer to scrape Meetup.com...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Meetup.com NYC events page
    const url = 'https://www.meetup.com/find/?location=us--ny--new_york&source=EVENTS';
    console.log('📄 Loading:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for events to load (Meetup uses React/dynamic loading)
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Scroll to load more events
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get page text
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('✅ Page loaded, extracting events with Gemini...');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    // Format date for prompt
    let dateFilter = '';
    let dateFormats = [];
    if (date) {
      const targetDate = new Date(date);
      dateFormats = [
        targetDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), // "Nov 7"
        date
      ];
      dateFilter = `\n\nCRITICAL: Only extract events that match ONE of these date formats: ${dateFormats.join(', ')}. Skip all other dates.`;
    }
    
    const prompt = `Extract all NYC events from this Meetup.com page content.
    
Page content:
${pageText.substring(0, 6000)}${dateFilter}

${date && dateFormats.length > 0 ? `IMPORTANT: Only extract events for ${dateFormats[0]}. Skip all other dates.` : 'Extract all events found.'}

Focus on tech meetups, social events, networking events, hobby groups, and community gatherings.

For each event, extract:
- name: Event name (e.g., "NYC Tech Networking Happy Hour", "Brooklyn Board Games Meetup")
- time: Date and time combined (e.g., "Friday, November 7, 2025 at 6:30 PM")
- location: Venue and neighborhood (e.g., "WeWork, Manhattan" or "Bryant Park")
- price: Price (usually "Free" for Meetup events) if mentioned
- link: Direct event URL if available in content, or null
- description: Brief description from content`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
                    time: { type: 'string', description: 'Date and time combined' },
                    location: { type: 'string', description: 'Venue and neighborhood' },
                    price: { type: 'string', description: 'Price (usually "Free")', nullable: true },
                    link: { type: 'string', description: 'Direct event URL', nullable: true },
                    description: { type: 'string', description: 'Brief description', nullable: true }
                  },
                  required: ['name', 'time', 'location']
                }
              }
            },
            required: ['events']
          }
        }
      })
    });
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    // Parse JSON response directly
    const extractedText = data.candidates[0].content.parts[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON response:', parseError);
      console.log('Raw response:', extractedText);
      return [];
    }
    
    console.log('✅ Events extracted from Meetup.com');
    
    // Convert to event objects with consistent structure
    const events = (parsedData.events || []).map(event => ({
      name: event.name,
      platform: 'Meetup',
      source: 'Meetup (Scraped)',
      link: event.link && event.link.startsWith('http') ? event.link : url,
      time: event.time,
      location: event.location,
      description: event.description || null,
      price: event.price || 'Free'
    }));
    
    if (events.length > 0) {
      console.log(`   → Parsed ${events.length} events with source: ${events[0].source}`);
    }
    return events;
    
  } catch (error) {
    console.error('❌ Error scraping Meetup.com:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


