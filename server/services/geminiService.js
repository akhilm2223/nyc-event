// Gemini AI configuration - uses v1beta REST API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

/**
 * Parse user query to extract intent (category, date, location)
 */
export const parseUserIntent = async (userQuery) => {
  try {
    const url = `${GEMINI_URL_BASE}/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `
You are an event discovery assistant. Parse the following user query and extract:
1. Event category/type (e.g., "concert", "sports", "tech meetup", "nightlife", "art", "food")
2. Date/time (e.g., "tonight", "this weekend", "tomorrow", specific date)
3. Location (neighborhood, city, venue name)
4. Keywords (other important terms)

User query: "${userQuery}"

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "category": "event type or null",
  "date": "when or null", 
  "location": "where or null",
  "keywords": ["keyword1", "keyword2"]
}
`;
    
    const body = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;
    
    // Parse JSON response
    const parsed = JSON.parse(text.trim());
    
    console.log('🧠 Parsed intent:', parsed);
    return parsed;
    
  } catch (error) {
    console.error('Error parsing user intent:', error);
    // Return default structure on error
    return {
      category: null,
      date: null,
      location: null,
      keywords: []
    };
  }
};

/**
 * Generate a conversational response from event data
 */
export const formatEventResponse = async (events, userQuery) => {
  try {
    if (!events || events.length === 0) {
      return "I couldn't find any events matching your query right now. Try asking about different dates or locations! 🔍";
    }
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro'
    });
    
    const eventsData = events.map(e => ({
      title: e.title,
      date: e.date,
      time: e.time,
      venue: e.venue,
      address: e.address,
      ticketLink: e.ticketLink
    }));
    
    const prompt = `
You are a friendly NYC event discovery assistant on Instagram. 

User asked: "${userQuery}"

Here are the events found:
${JSON.stringify(eventsData, null, 2)}

Create a friendly, conversational Instagram DM response that:
1. Directly answers their question
2. Lists events with emojis (use 🏈 🎵 💡 🎨 🍕 etc based on category)
3. Includes venue, time, and ticket link if available
4. Keeps it concise and Instagram-friendly (max 800 chars)
5. Ends with a helpful call-to-action

Format example:
"Here are 3 events I found 👇

🏈 Jets vs Giants
📍 MetLife Stadium, 7 PM
🎟️ [Ticket link]

🎵 Rooftop Jazz Night
📍 Brooklyn Heights, 8 PM
Free entry

Need more info? Just ask!"
`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text.trim();
    
  } catch (error) {
    console.error('Error formatting response:', error);
    
    // Fallback formatting
    let response = `Here are ${events.length} events I found:\n\n`;
    events.slice(0, 3).forEach((event, i) => {
      response += `${i + 1}. ${event.title}\n`;
      response += `📍 ${event.venue}${event.time ? ', ' + event.time : ''}\n`;
      if (event.ticketLink) response += `🎟️ ${event.ticketLink}\n`;
      response += '\n';
    });
    
    return response;
  }
};

/**
 * Use Gemini to search for events when APIs don't return results
 * This acts as a fallback using Gemini's web search capabilities
 */
export const searchEventsWithAI = async (userQuery) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro'
    });
    
    const prompt = `
Search the web for real events matching this query: "${userQuery}"

Find actual upcoming events with:
- Event name
- Date and time
- Venue/location
- Brief description
- Ticket link (if available)

Return up to 5 real events in JSON format:
[
  {
    "title": "Event Name",
    "description": "Brief description",
    "date": "YYYY-MM-DD",
    "time": "7:00 PM",
    "venue": "Venue Name",
    "address": "Full address",
    "ticketLink": "URL or null"
  }
]

Only include real, verified events. If you can't find any, return an empty array [].
`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const events = JSON.parse(jsonMatch[0]);
      console.log(`🌐 Found ${events.length} events via AI search`);
      return events;
    }
    
    return [];
    
  } catch (error) {
    console.error('Error searching events with AI:', error);
    return [];
  }
};

