import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeGoodRecSport, scrapeNYCForFreeEvents } from '../services/dynamicScraperService.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, '../../events.json');

/**
 * Normalize event data to the required format
 */
function normalizeEvent(event, source) {
  // Extract date and time from the time field if it contains both
  let date = null;
  let time = null;
  
  // GoodRec events have date+time in the time field like "Friday, August 1, 2025 at 04:00 PM"
  if (event.time) {
    // Try to parse "Friday, August 1, 2025 at 04:00 PM" or "August 1, 2025 at 04:00 PM" format
    const timeMatch = event.time.match(/(.+?)\s+at\s+(.+)/i);
    if (timeMatch) {
      date = timeMatch[1].trim();
      time = timeMatch[2].trim();
    } else {
      // Check if it's just a date (contains day name or month name)
      if (event.time.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i) ||
          event.time.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
          event.time.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i)) {
        date = event.time;
        time = null;
      } else if (event.time.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
        // It's just a time
        time = event.time;
      } else {
        // Default: treat as date if it looks like a date
        date = event.time;
      }
    }
  }
  
  // Use date field if available (NYC for FREE uses separate date field)
  if (event.date && !date) {
    date = event.date;
  }
  
  // Clean up "Not specified" values
  if (date === 'Not specified') date = null;
  if (time === 'Not specified' || time === null) time = null;
  
  return {
    name: event.name || 'Untitled Event',
    date: date || 'Not specified',
    time: time || null,
    location: event.location || 'Not specified',
    link: event.link || 'https://www.goodrec.com'
  };
}

/**
 * Check if two events are duplicates
 */
function isDuplicate(event1, event2) {
  // Normalize names for comparison
  const name1 = (event1.name || '').toLowerCase().trim();
  const name2 = (event2.name || '').toLowerCase().trim();
  
  // Check if names are very similar (allowing for minor differences)
  if (name1 === name2) {
    return true;
  }
  
  // Check if same date and location (likely same event)
  const date1 = (event1.date || '').toLowerCase().trim();
  const date2 = (event2.date || '').toLowerCase().trim();
  const loc1 = (event1.location || '').toLowerCase().trim();
  const loc2 = (event2.location || '').toLowerCase().trim();
  
  if (date1 && date2 && loc1 && loc2 && date1 === date2 && loc1 === loc2) {
    // Check if names are similar (at least 80% match)
    const similarity = calculateSimilarity(name1, name2);
    if (similarity > 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate string similarity (simple Jaccard-like similarity)
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

/**
 * Merge new events with existing events, removing duplicates
 */
function mergeEvents(existingEvents, newEvents) {
  const merged = [...existingEvents];
  
  for (const newEvent of newEvents) {
    // Check if this event already exists
    const exists = merged.some(existing => isDuplicate(existing, newEvent));
    if (!exists) {
      merged.push(newEvent);
    }
  }
  
  return merged;
}

/**
 * Main scraping function - Scrapes ALL GoodRec sports/activities in NYC
 */
async function scrapeAllEvents() {
  console.log('🚀 Starting GoodRec ALL events scraping for NYC...\n');
  
  const allEvents = [];
  
  // All GoodRec sports/activities available in NYC
  const goodRecSports = [
    { url: '/pickup-soccer/new-york-city', name: 'Soccer' },
    { url: '/play-volleyball/new-york-city', name: 'Volleyball' },
    { url: '/pickup-basketball/new-york-city', name: 'Basketball' },
  ];
  
  // Scrape each sport
  for (const sport of goodRecSports) {
    try {
      console.log(`\n📋 Scraping GoodRec ${sport.name} events...`);
      const sportEvents = await scrapeGoodRecSport(sport.url, sport.name, null); // null = get all events
      console.log(`✅ Found ${sportEvents.length} GoodRec ${sport.name} events`);
      
      // Normalize events
      const normalized = sportEvents.map(event => normalizeEvent(event, 'GoodRec'));
      allEvents.push(...normalized);
      
    } catch (error) {
      console.error(`❌ Error scraping GoodRec ${sport.name}:`, error.message);
    }
  }
  
  // Scrape NYC for FREE events
  try {
    console.log('\n📋 Scraping NYC for FREE events...');
    const nycForFreeEvents = await scrapeNYCForFreeEvents();
    console.log(`✅ Found ${nycForFreeEvents.length} NYC for FREE events`);
    
    // Normalize NYC for FREE events
    const normalizedFree = nycForFreeEvents.map(event => normalizeEvent(event, 'NYC for FREE'));
    allEvents.push(...normalizedFree);
    
  } catch (error) {
    console.error('❌ Error scraping NYC for FREE:', error.message);
  }
  
  // Load existing events if file exists
  let existingEvents = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const fileContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
      existingEvents = JSON.parse(fileContent);
      console.log(`\n📂 Loaded ${existingEvents.length} existing events from ${OUTPUT_FILE}`);
    } catch (error) {
      console.error('⚠️ Error reading existing events file:', error.message);
      existingEvents = [];
    }
  }
  
  // Merge events and remove duplicates
  console.log('\n🔄 Merging events and removing duplicates...');
  const mergedEvents = mergeEvents(existingEvents, allEvents);
  console.log(`✅ Total unique events: ${mergedEvents.length} (${allEvents.length} new, ${existingEvents.length} existing)`);
  
  // Save to JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mergedEvents, null, 2), 'utf8');
  console.log(`\n💾 Saved ${mergedEvents.length} events to ${OUTPUT_FILE}`);
  
  return mergedEvents;
}

// Run if called directly (check if this file is the main module)
const isMainModule = process.argv[1] && 
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) || 
   import.meta.url.includes('scrapeNYCEvents.js'));

if (isMainModule) {
  scrapeAllEvents()
    .then(() => {
      console.log('\n✅ Scraping completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Scraping failed:', error);
      process.exit(1);
    });
}

export { scrapeAllEvents };
