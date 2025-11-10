# Event Enrichment System 🎉

This system enriches event data from `events.json` using **Perplexity API** for web search and **Gemini API** for intelligent enhancement.

## 🔄 How It Works

```
events.json → Perplexity API (Search) → Gemini API (Enhance) → enriched-events.json
```

### Process Flow:

1. **Read Events** - Loads all events from `events.json`
2. **Search with Perplexity** - For each event, searches the web for additional details, venue information, pricing, and context
3. **Enhance with Gemini** - Uses AI to analyze the original data + search results and create rich descriptions with categories, key features, and tips
4. **Save Results** - Outputs to `enriched-events.json`

## 🚀 Quick Start

### 1. Set Up Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Required: Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Required: Perplexity API Key  
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

**Get API Keys:**
- **Gemini API**: https://aistudio.google.com/app/apikey
- **Perplexity API**: https://www.perplexity.ai/settings/api

### 2. Run Event Enrichment

```bash
# Navigate to server directory
cd server

# Test with 3 events first (recommended)
npm run enrich:test

# Or process all events
npm run enrich:events
```

## 📦 Output Format

The enriched events include:

```json
{
  "title": "9 v 9 CO-ED Pickup Soccer In Bushwick Inlet",
  "date": "Friday, August 1, 2025",
  "time": "09:00 AM",
  "location": "Bushwick Inlet, Williamsburg",
  "link": "https://www.goodrec.com/pickup-soccer/new-york-city",
  
  // New enriched fields:
  "enriched": true,
  "enhancedDescription": "Join a fun 9v9 co-ed pickup soccer game at the scenic Bushwick Inlet Park...",
  "category": "Sports",
  "keyFeatures": [
    "Co-ed recreational soccer",
    "Waterfront location",
    "All skill levels welcome"
  ],
  "pricing": "$15-20",
  "attendeeTips": "Bring cleats, water, and sunscreen. Arrive 10 minutes early.",
  "perplexitySearchResults": "Detailed information from web search...",
  "enrichedAt": "2025-11-08T12:00:00.000Z"
}
```

## 🛠️ Usage in Code

```javascript
import { 
  enrichEvent, 
  enrichEventsFromFile,
  enrichAndSaveEvents 
} from './services/eventEnrichmentService.js';

// Enrich a single event
const enrichedEvent = await enrichEvent({
  title: "My Event",
  location: "Brooklyn, NY",
  date: "November 10, 2025"
});

// Enrich first 5 events from file
const enrichedData = await enrichEventsFromFile(5);

// Enrich all events and save
await enrichAndSaveEvents();
```

## 🎯 Features

### Perplexity Integration
- Real-time web search for event details
- Venue information lookup
- Pricing and registration details
- Context about the event type

### Gemini Enhancement
- Intelligent categorization (Sports, Art, Music, etc.)
- Rich descriptions combining original + search data
- Key features extraction
- Attendee tips and recommendations
- Pricing standardization

## ⚙️ Configuration

### Rate Limiting

The system includes built-in delays (1 second between events) to avoid API rate limits. Adjust in `eventEnrichmentService.js`:

```javascript
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
```

### Processing Limits

Process a limited number of events (useful for testing):

```javascript
await enrichEventsFromFile(10); // Only process 10 events
```

## 📝 Available Scripts

```bash
npm run enrich:events    # Process all events
npm run enrich:test      # Process only 3 events (testing)
```

Or run directly:

```bash
node scripts/enrichEvents.js        # All events
node scripts/enrichEvents.js 5      # First 5 events
```

## 🔍 Example Output

**Before (from events.json):**
```json
{
  "title": "La Beauté Louis Vuitton Pop-Up",
  "time": "11:00 AM – 6:00 PM",
  "location": "104 Prince Street"
}
```

**After (enriched):**
```json
{
  "title": "La Beauté Louis Vuitton Pop-Up",
  "time": "11:00 AM – 6:00 PM",
  "location": "104 Prince Street",
  "enriched": true,
  "enhancedDescription": "Experience Louis Vuitton's immersive beauty pop-up in SoHo, featuring exclusive fragrances, skincare consultations, and luxury beauty products in an elegantly designed space.",
  "category": "Shopping & Beauty",
  "keyFeatures": [
    "Luxury beauty products",
    "Free consultations",
    "Exclusive LV fragrance line",
    "Instagram-worthy experience"
  ],
  "pricing": "Free entry",
  "attendeeTips": "Book consultations in advance if possible. The pop-up gets busy on weekends, so weekday mornings are ideal for a more personalized experience.",
  "enrichedAt": "2025-11-08T15:30:00.000Z"
}
```

## 🐛 Troubleshooting

### "PERPLEXITY_API_KEY not configured"
- Make sure you have a `.env` file in the `server/` directory
- Verify your API key is valid
- Check that `dotenv` is properly loading the environment variables

### API Rate Limits
- Reduce the number of events processed
- Increase the delay between requests
- Check your API usage limits on Perplexity/Gemini dashboards

### No enrichment happening
- Check console logs for API errors
- Verify both API keys are set correctly
- Make sure `events.json` exists and is valid JSON

## 📊 Cost Considerations

- **Perplexity API**: ~$0.001-0.005 per request (check current pricing)
- **Gemini API**: Free tier available, then pay-per-use
- Processing ~100 events = approximately $0.10-0.50

## 🔐 Security Notes

- Never commit `.env` files to version control
- Keep API keys secure
- Use environment variables in production
- Consider rate limiting for production use

## 📚 Related Files

- `server/services/eventEnrichmentService.js` - Main enrichment logic
- `server/scripts/enrichEvents.js` - CLI script
- `events.json` - Input data
- `enriched-events.json` - Output data (generated)

## 🤝 Contributing

To add new enrichment features:

1. Modify `enhanceEventWithGemini()` to request additional fields
2. Update the JSON schema in the Gemini API call
3. Test with `npm run enrich:test` first
4. Document new fields in this README

---

**Happy Event Enriching! 🎊**

## 🧠 New: Ask AI for Citywide Event Counts

Use the bundled research script to ask Perplexity and Gemini for a snapshot of NYC happenings across all categories.

```bash
cd server
npm run ai:counts              # Default window: next 7 days
npm run ai:counts:weekend      # Quick look at this weekend
node scripts/queryAIEventCounts.js "next 30 days"  # Custom timeframe
```

The script will:
- Send a unified prompt to both APIs
- Print each model's narrative summary and event counts
- Append a structured entry (metadata + parsed insights) to `ai-nyc-event-counts.json`

The JSON log grows over time, so each run keeps a historical record with:
- Metadata (prompt, timeframe input, auto-generated date range, timestamp)
- Perplexity summary, category ranges, notable events, raw response
- Gemini qualitative estimates, category signals, methodology, caveats, raw response

> Tip: Adjust the timeframe argument ("tonight", "December", etc.) to tailor the research focus.

