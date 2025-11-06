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

Extract each game with:
- Event name (e.g., "9 v 9 CO-ED Pickup Soccer In Bushwick Inlet")
- Date (e.g., "Friday, August 1, 2025")
- Time (e.g., "09:00 AM" or "9:00 AM")
- Location (e.g., "Bushwick Inlet, Williamsburg")
- Format (9v9, 11v11, etc.)
- Duration if mentioned

Format each event as:
Event Name
Date & Time: [date] at [time]
Location: [location]
Format: [format]
Platform: GoodRec
Link: https://www.goodrec.com/pickup-soccer/new-york-city
Description: [format] pickup soccer game

${date && dateFormats.length > 0 ? `IMPORTANT: Only show games for ${dateFormats[0]}. Skip all other dates.` : 'Show all games found.'}`;

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
    
    console.log('✅ Events extracted from GoodRec');
    
    // Parse the extracted text into event objects
    return parseEventsFromText(extractedText, 'GoodRec', url);
    
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
        !trimmed.match(/^(Date|Time|Location|Platform|Link|Description|Format|Price)/i) &&
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

