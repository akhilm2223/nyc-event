import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

/**
 * Search for events using Perplexity API
 * @param {string} userQuery - User's search query
 * @param {string} conversationContext - Recent conversation history
 * @returns {Promise<Object>} - { content: string, citations: string[] }
 */
export async function searchEventsWithPerplexity(userQuery, conversationContext = '') {
  try {
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    const prompt = `Find real, upcoming events in New York City for: "${userQuery}"

Search for events on platforms like:
- Eventbrite.com
- Meetup.com
- Luma.com
- Dice.fm
- Resident Advisor
- Time Out New York
- The Skint
- NYC event venues

For each event found, provide:
- Event name
- Date and time
- Venue/location
- Price (if available)
- Direct link to event page
- Brief description

Focus on events happening soon (today, tomorrow, this week, this weekend).
Only include real events with actual dates and venues.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful NYC event discovery assistant. Search the web for real, current events and provide accurate information with sources.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        return_citations: true,
        search_recency_filter: 'week'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('No response from Perplexity API');
    }

    const content = data.choices[0].message.content;
    const citations = data.citations || [];

    console.log(`✅ Perplexity found ${citations.length} sources`);

    return {
      content,
      citations
    };

  } catch (error) {
    console.error('❌ Perplexity API error:', error.message);
    throw error;
  }
}
