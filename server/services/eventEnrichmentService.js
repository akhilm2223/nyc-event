import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Search for event information using Perplexity API
 * @param {Object} event - Event object with title, location, date, etc.
 * @returns {Promise<string>} - Search results from Perplexity
 */
async function searchEventWithPerplexity(event) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  try {
    const eventTitle = event.title || event.name || '';
    const eventLocation = event.location || '';
    const eventDate = event.date || event.time || event.fullDate || '';

    // Create a search query
    const searchQuery = `${eventTitle} ${eventLocation} ${eventDate} New York City event details venue information`;

    console.log(`🔍 Searching Perplexity for: ${eventTitle}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides detailed information about events in New York City. Provide concise, factual information about the event, venue, what to expect, and any additional useful details.'
          },
          {
            role: 'user',
            content: `Find detailed information about this NYC event: ${eventTitle} at ${eventLocation} on ${eventDate}. Include venue details, what attendees can expect, pricing if available, and any other relevant information.`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Perplexity API error:', errorText);
      return null;
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const searchResults = data.choices[0].message.content;
      console.log(`✅ Found information via Perplexity for: ${eventTitle}`);
      return searchResults;
    }

    return null;
  } catch (error) {
    console.error('❌ Error searching with Perplexity:', error.message);
    return null;
  }
}

/**
 * Enhance event data using Gemini API
 * @param {Object} event - Original event object
 * @param {string} perplexityResults - Search results from Perplexity
 * @returns {Promise<Object>} - Enhanced event object
 */
async function enhanceEventWithGemini(event, perplexityResults) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    const eventTitle = event.title || event.name || '';
    console.log(`🤖 Enhancing with Gemini: ${eventTitle}`);

    const prompt = `You are an event information specialist. Based on the original event data and additional research, create an enhanced event description.

Original Event:
- Title: ${event.title || event.name || 'N/A'}
- Location: ${event.location || 'N/A'}
- Date/Time: ${event.date || event.time || event.fullDate || 'N/A'}
- Link: ${event.link || 'N/A'}

Additional Information from Web Search:
${perplexityResults || 'No additional information found'}

Create an enhanced event object with the following:
1. A rich, informative description (2-3 sentences) that combines the original data with the additional information
2. Extract or infer the category (e.g., "Sports", "Art", "Food & Drink", "Entertainment", "Pop-up", "Music", "Networking", etc.)
3. Highlight key features or selling points
4. Indicate if it's free or paid
5. Add any important notes or tips for attendees

Format the response as JSON with these fields:
- enhancedDescription: string
- category: string
- keyFeatures: array of strings
- pricing: string (e.g., "Free", "$20", "Unknown")
- attendeeTips: string (optional tips)`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

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
              enhancedDescription: { type: 'string' },
              category: { type: 'string' },
              keyFeatures: {
                type: 'array',
                items: { type: 'string' }
              },
              pricing: { type: 'string' },
              attendeeTips: { type: 'string', nullable: true }
            },
            required: ['enhancedDescription', 'category', 'keyFeatures', 'pricing']
          }
        }
      })
    });

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]) {
      console.error('❌ No response from Gemini');
      return event;
    }

    const extractedText = data.candidates[0].content.parts[0].text;
    let enhancement;
    
    try {
      enhancement = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON:', parseError);
      return event;
    }

    console.log(`✅ Enhanced event: ${eventTitle}`);

    // Return the original event with enhancements
    return {
      ...event,
      enriched: true,
      enhancedDescription: enhancement.enhancedDescription,
      category: enhancement.category,
      keyFeatures: enhancement.keyFeatures,
      pricing: enhancement.pricing,
      attendeeTips: enhancement.attendeeTips,
      perplexitySearchResults: perplexityResults,
      enrichedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error enhancing with Gemini:', error.message);
    return event;
  }
}

/**
 * Process a single event: Search with Perplexity, enhance with Gemini
 * @param {Object} event - Event object to enrich
 * @returns {Promise<Object>} - Enriched event object
 */
export async function enrichEvent(event) {
  try {
    // Step 1: Search for additional info with Perplexity
    const perplexityResults = await searchEventWithPerplexity(event);

    // Step 2: Enhance with Gemini using original data + Perplexity results
    const enrichedEvent = await enhanceEventWithGemini(event, perplexityResults);

    return enrichedEvent;
  } catch (error) {
    console.error('❌ Error enriching event:', error.message);
    return event; // Return original event if enrichment fails
  }
}

/**
 * Read events from events.json and enrich them
 * @param {number} limit - Maximum number of events to process (optional)
 * @returns {Promise<Object>} - Object with enriched events organized by source
 */
export async function enrichEventsFromFile(limit = null) {
  try {
    console.log('\n📚 Reading events from events.json...');
    
    // Read events.json from project root
    const eventsFilePath = path.join(process.cwd(), 'events.json');
    const fileContent = await fs.readFile(eventsFilePath, 'utf-8');
    const eventsData = JSON.parse(fileContent);

    console.log('✅ Events file loaded successfully');

    const enrichedData = {};
    let processedCount = 0;

    // Process GoodRec events
    if (eventsData.goodrec) {
      enrichedData.goodrec = {};
      
      for (const [sport, events] of Object.entries(eventsData.goodrec)) {
        console.log(`\n🏃 Processing GoodRec ${sport} events...`);
        enrichedData.goodrec[sport] = [];

        for (const event of events) {
          if (limit && processedCount >= limit) {
            console.log(`\n⚠️ Reached limit of ${limit} events`);
            break;
          }

          const enrichedEvent = await enrichEvent(event);
          enrichedData.goodrec[sport].push(enrichedEvent);
          processedCount++;

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (limit && processedCount >= limit) break;
      }
    }

    // Process NYC for FREE events
    if (eventsData.nycforfree && !limit || processedCount < limit) {
      enrichedData.nycforfree = {};

      for (const [day, events] of Object.entries(eventsData.nycforfree)) {
        if (limit && processedCount >= limit) break;

        console.log(`\n🎉 Processing NYC for FREE events for day ${day}...`);
        enrichedData.nycforfree[day] = [];

        for (const event of events) {
          if (limit && processedCount >= limit) {
            console.log(`\n⚠️ Reached limit of ${limit} events`);
            break;
          }

          const enrichedEvent = await enrichEvent(event);
          enrichedData.nycforfree[day].push(enrichedEvent);
          processedCount++;

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (limit && processedCount >= limit) break;
      }
    }

    console.log(`\n✅ Enriched ${processedCount} events total`);

    return enrichedData;

  } catch (error) {
    console.error('❌ Error reading/enriching events file:', error.message);
    throw error;
  }
}

/**
 * Save enriched events to a new JSON file
 * @param {Object} enrichedData - Enriched events data
 * @param {string} outputFilename - Output filename (default: 'enriched-events.json')
 */
export async function saveEnrichedEvents(enrichedData, outputFilename = 'enriched-events.json') {
  try {
    const outputPath = path.join(process.cwd(), outputFilename);
    await fs.writeFile(outputPath, JSON.stringify(enrichedData, null, 2), 'utf-8');
    console.log(`\n💾 Enriched events saved to: ${outputFilename}`);
  } catch (error) {
    console.error('❌ Error saving enriched events:', error.message);
    throw error;
  }
}

/**
 * Main function to enrich all events and save them
 * @param {number} limit - Maximum number of events to process (optional)
 */
export async function enrichAndSaveEvents(limit = null) {
  console.log('\n🚀 Starting event enrichment process...\n');
  console.log('📋 Process:');
  console.log('   1. Read events from events.json');
  console.log('   2. For each event: Search with Perplexity API');
  console.log('   3. Enhance data with Gemini API');
  console.log('   4. Save enriched events to file\n');

  try {
    // Enrich events
    const enrichedData = await enrichEventsFromFile(limit);

    // Save to file
    await saveEnrichedEvents(enrichedData);

    console.log('\n✅ Event enrichment completed successfully! 🎉');
    
    return enrichedData;

  } catch (error) {
    console.error('\n❌ Event enrichment failed:', error.message);
    throw error;
  }
}

