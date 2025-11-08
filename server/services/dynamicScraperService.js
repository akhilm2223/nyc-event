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
  return scrapeGoodRecSport('/pickup-soccer/new-york-city', 'Soccer', date);
}

/**
 * Generic scraper for any GoodRec sport/activity page in NYC
 * @param {string} sportUrl - The GoodRec URL path (e.g., '/pickup-soccer/new-york-city')
 * @param {string} sportName - Name of the sport (e.g., 'Soccer', 'Volleyball', 'Basketball')
 * @param {string} date - Date to search for (optional, format: "YYYY-MM-DD")
 * @returns {Promise<Array>} - Array of extracted events (NYC only)
 */
export async function scrapeGoodRecSport(sportUrl, sportName, date = null) {
  let browser = null;
  try {
    console.log(`🌐 Launching Puppeteer to scrape GoodRec ${sportName}...`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Construct full URL
    const url = sportUrl.startsWith('http') ? sportUrl : `https://www.goodrec.com${sportUrl}`;
    console.log('📄 Loading:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for game cards to load (they're dynamically loaded)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract text content
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
        date
      ];
      dateFilter = `\n\nCRITICAL: Only extract games that match ONE of these date formats: ${dateFormats.join(', ')}. Skip all other dates.`;
    }
    
    const prompt = `Extract all ${sportName.toLowerCase()} games/events from this GoodRec NYC page content. 
    
CRITICAL: ONLY extract games in New York City, New York. Skip any games in New Jersey or other cities.

Page content:
${pageText.substring(0, 8000)}${dateFilter}

Extract each game with:
- Event name (e.g., "CO-ED Pickup ${sportName} In [Location]")
- Date (e.g., "Friday, August 1, 2025")
- Time (e.g., "04:00 PM" or "4:00 PM")
- Location (e.g., "Greenpoint, Brooklyn" or venue name)
- Duration if mentioned (e.g., "120 minutes")
- Format if mentioned (e.g., "5v5", "9v9", "11v11")
- Skill level if mentioned (Social, Intermediate, High Intermediate, Advanced)

Format each event as:
Event Name
Date & Time: [date] at [time]
Location: [location, New York City]
Duration: [duration if available]
Format: [format if available]
Platform: GoodRec
Link: ${url}
Description: ${sportName.toLowerCase()} game in NYC

${date && dateFormats.length > 0 ? `IMPORTANT: Only show games for ${dateFormats[0]}. Skip all other dates.` : 'Show all games found.'}
CRITICAL: Only include games in New York City. Filter out New Jersey and other cities.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      })
    });
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    const extractedText = data.candidates[0].content.parts[0].text;
    
    console.log(`✅ Events extracted from GoodRec ${sportName}`);
    
    // Parse the extracted text into event objects
    const events = parseEventsFromText(extractedText, 'GoodRec', url);
    
    // Filter to ensure only NYC events (double-check)
    return events.filter(event => {
      const location = (event.location || '').toLowerCase();
      const name = (event.name || '').toLowerCase();
      // Include NYC, Brooklyn, Manhattan, Queens, Bronx, Staten Island
      // Exclude New Jersey, Jersey City, etc.
      return (location.includes('new york') || location.includes('brooklyn') || 
              location.includes('manhattan') || location.includes('queens') || 
              location.includes('bronx') || location.includes('staten island') ||
              name.includes('brooklyn') || name.includes('manhattan') || 
              name.includes('queens') || name.includes('bronx')) &&
             !location.includes('new jersey') && !location.includes('jersey city') &&
             !name.includes('new jersey') && !name.includes('jersey city');
    });
    
  } catch (error) {
    console.error(`❌ Error scraping GoodRec ${sportName}:`, error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape GoodRec Volleyball NYC page using Puppeteer and extract events with Gemini
 * @param {string} date - Date to search for (optional, format: "YYYY-MM-DD")
 * @returns {Promise<Array>} - Array of extracted events (NYC only)
 */
export async function scrapeGoodRecVolleyball(date = null) {
  return scrapeGoodRecSport('/play-volleyball/new-york-city', 'Volleyball', date);
}

/**
 * Scrape NYC for FREE events page using Puppeteer and extract events with Gemini
 * @returns {Promise<Array>} - Array of extracted events (NYC only)
 */
export async function scrapeNYCForFreeEvents() {
  let browser = null;
  try {
    console.log('🌐 Launching Puppeteer to scrape NYC for FREE...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to NYC for FREE events page
    const url = 'https://www.nycforfree.co/events';
    console.log('📄 Loading:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for events to load (they're dynamically loaded)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract text content
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('✅ Page loaded, extracting events with Gemini...');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    const prompt = `Extract all events from this NYC for FREE page content. 

CRITICAL: ONLY extract events in New York City, New York. Skip any events in other cities or states.

Page content:
${pageText.substring(0, 10000)}

Extract each event with:
- Event name
- Date (e.g., "Friday, August 1, 2025" or "August 1, 2025")
- Time (e.g., "04:00 PM" or "4:00 PM" or "All Day" if no specific time)
- Location (venue name and neighborhood/city)
- Direct event link if available

Format each event as:
Event Name
Date: [date]
Time: [time or "Not specified"]
Location: [location, New York City]
Platform: NYC for FREE
Link: [direct event URL or https://www.nycforfree.co/events]
Description: Free event in NYC

CRITICAL: Only include events in New York City. Filter out events in other cities or states.
Only extract actual events. Ignore navigation menus, headers, footers, and non-event content.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      })
    });
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    const extractedText = data.candidates[0].content.parts[0].text;
    
    console.log('✅ Events extracted from NYC for FREE');
    
    // Parse the extracted text into event objects
    const events = parseNYCForFreeEvents(extractedText, url);
    
    // Filter to ensure only NYC events (double-check)
    return events.filter(event => {
      const location = (event.location || '').toLowerCase();
      const name = (event.name || '').toLowerCase();
      // Include NYC, Brooklyn, Manhattan, Queens, Bronx, Staten Island
      // Exclude other states and cities
      return (location.includes('new york') || location.includes('brooklyn') || 
              location.includes('manhattan') || location.includes('queens') || 
              location.includes('bronx') || location.includes('staten island') ||
              location.includes('nyc') || name.includes('brooklyn') || 
              name.includes('manhattan') || name.includes('queens') || 
              name.includes('bronx')) &&
             !location.includes('new jersey') && !location.includes('jersey city') &&
             !name.includes('new jersey') && !name.includes('jersey city');
    });
    
  } catch (error) {
    console.error('❌ Error scraping NYC for FREE:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Parse NYC for FREE events from Gemini-extracted text
 * @param {string} text - Text from Gemini
 * @param {string} baseUrl - Base URL for links
 * @returns {Array} - Array of event objects
 */
function parseNYCForFreeEvents(text, baseUrl) {
  const events = [];
  const lines = text.split('\n');
  
  let currentEvent = null;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    if (!trimmed || trimmed === '---' || trimmed.startsWith('=====')) {
      // Save current event if we hit a separator
      if (currentEvent && currentEvent.name && currentEvent.name !== '**Event Name**') {
        events.push(currentEvent);
        currentEvent = null;
      }
      continue;
    }
    
    // Detect event name - look for lines that look like titles
    if (!currentEvent && trimmed.length > 10 && 
        !trimmed.includes(':') && 
        !trimmed.match(/^(Date|Time|Location|Platform|Link|Description)/i) &&
        !trimmed.match(/^(Events|Here are|NYC|Free)/i)) {
      // Remove markdown formatting
      const cleanName = trimmed.replace(/^\*\*|\*\*$/g, '').trim();
      if (cleanName.length > 10) {
        currentEvent = {
          name: cleanName,
          platform: 'NYC for FREE',
          link: baseUrl,
          date: null,
          time: null,
          location: null,
          description: null
        };
      }
    } else if (currentEvent) {
      // Parse event details
      if (trimmed.match(/Date:/i)) {
        currentEvent.date = trimmed.replace(/Date:/i, '').trim().replace(/\*\*\*/g, '').trim();
      } else if (trimmed.match(/Time:/i)) {
        currentEvent.time = trimmed.replace(/Time:/i, '').trim().replace(/\*\*\*/g, '').trim();
        if (currentEvent.time === 'Not specified' || currentEvent.time.toLowerCase() === 'not specified') {
          currentEvent.time = null;
        }
      } else if (trimmed.match(/Location:/i)) {
        currentEvent.location = trimmed.replace(/Location:/i, '').trim().replace(/\*\*\*/g, '').trim();
      } else if (trimmed.match(/Link:/i)) {
        const link = trimmed.replace(/Link:/i, '').trim();
        if (link && link.startsWith('http')) {
          currentEvent.link = link;
        }
      } else if (trimmed.match(/Description:/i)) {
        currentEvent.description = trimmed.replace(/Description:/i, '').trim();
      } else if (trimmed.length > 10 && !trimmed.includes(':') && !currentEvent.name) {
        // Might be event name on next line
        currentEvent.name = trimmed.replace(/^\*\*|\*\*$/g, '').trim();
      }
    }
  }
  
  // Save last event
  if (currentEvent && currentEvent.name && currentEvent.name !== '**Event Name**') {
    events.push(currentEvent);
  }
  
  // Filter out invalid events
  return events.filter(e => e.name && e.name.length > 5 && e.name !== '**Event Name**');
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

Extract each event with:
- Event name
- Date (e.g., "Friday, November 7, 2025")
- Time (e.g., "5:30 PM")
- Location (venue name and neighborhood)
- Price if mentioned
- Direct event URL if available

Format each event as:
Event Name
Date & Time: [date] at [time]
Location: [venue, neighborhood]
Price: [price or "Check link"]
Platform: Luma
Link: [direct event URL or https://luma.com/nyc]
Description: [brief description]

${date && dateFormats.length > 0 ? `IMPORTANT: Only show events for ${dateFormats[0]}. Skip all other dates.` : 'Show all events found.'}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      })
    });
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    const extractedText = data.candidates[0].content.parts[0].text;
    
    console.log('✅ Events extracted from Luma');
    
    return parseEventsFromText(extractedText, 'Luma', url);
    
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
 * Parse events from Gemini-extracted text
 * @param {string} text - Text from Gemini
 * @param {string} platform - Platform name
 * @param {string} baseUrl - Base URL for links
 * @returns {Array} - Array of event objects
 */
function parseEventsFromText(text, platform, baseUrl) {
  const events = [];
  const lines = text.split('\n');
  
  let currentEvent = null;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    if (!trimmed || trimmed === '---' || trimmed.startsWith('=====')) {
      // Save current event if we hit a separator
      if (currentEvent && currentEvent.name && currentEvent.name !== '**Event Name**') {
        events.push(currentEvent);
        currentEvent = null;
      }
      continue;
    }
    
    // Detect event name - look for lines that look like titles (even with markdown **)
    if (!currentEvent && trimmed.length > 15 && 
        !trimmed.includes(':') && 
        !trimmed.match(/^(Date|Time|Location|Platform|Link|Description|Format|Price|Duration)/i) &&
        !trimmed.match(/^(Pickup|Games|Events|Here are)/i)) {
      // Remove markdown formatting
      const cleanName = trimmed.replace(/^\*\*|\*\*$/g, '').trim();
      if (cleanName.length > 15) {
        currentEvent = {
          name: cleanName,
          platform: platform,
          link: baseUrl,
          time: null,
          location: null,
          description: null,
          price: null
        };
      }
    } else if (currentEvent) {
      // Parse event details
      if (trimmed.match(/Date & Time:|Time:/i)) {
        currentEvent.time = trimmed.replace(/Date & Time:|Time:/i, '').trim().replace(/\*\*\*/g, '').trim();
      } else if (trimmed.match(/Location:/i)) {
        currentEvent.location = trimmed.replace(/Location:/i, '').trim().replace(/\*\*\*/g, '').trim();
      } else if (trimmed.match(/Link:/i)) {
        const link = trimmed.replace(/Link:/i, '').trim();
        if (link && link.startsWith('http')) {
          currentEvent.link = link;
        }
      } else if (trimmed.match(/Description:/i)) {
        currentEvent.description = trimmed.replace(/Description:/i, '').trim();
      } else if (trimmed.match(/Price:/i)) {
        currentEvent.price = trimmed.replace(/Price:/i, '').trim();
      } else if (trimmed.match(/Format:/i)) {
        currentEvent.format = trimmed.replace(/Format:/i, '').trim();
        if (!currentEvent.description) {
          currentEvent.description = `${currentEvent.format} pickup soccer game`;
        }
      } else if (trimmed.match(/Duration:/i)) {
        currentEvent.duration = trimmed.replace(/Duration:/i, '').trim();
      } else if (trimmed.length > 10 && !trimmed.includes(':') && !currentEvent.name) {
        // Might be event name on next line
        currentEvent.name = trimmed.replace(/^\*\*|\*\*$/g, '').trim();
      }
    }
  }
  
  // Save last event
  if (currentEvent && currentEvent.name && currentEvent.name !== '**Event Name**') {
    events.push(currentEvent);
  }
  
  // Filter out invalid events
  return events.filter(e => e.name && e.name.length > 5 && e.name !== '**Event Name**');
}

