# LLM Architecture Explanation

## Overview
The system uses a **two-stage LLM architecture** combining **Perplexity AI** (for real-time web search) and **Google Gemini** (for natural language response generation) to help users find events in NYC.

## Architecture Components

### 1. **Perplexity AI Service** (`perplexityService.js`)
   - **Purpose**: Real-time web search and information retrieval
   - **Models Used**:
     - `sonar-pro`: For event searches with citations
     - `sonar`: For general queries
   - **Features**:
     - Real-time web search with citations
     - Recency filter (last week)
     - Returns structured data with source URLs

### 2. **Google Gemini Service** (in `chat.js`)
   - **Purpose**: Natural language response generation
   - **Model Used**: `gemini-2.0-flash-lite`
   - **Features**:
     - Formats responses in a conversational tone
     - Uses event data from Perplexity + database as context
     - Maintains conversation history
     - NYC Event AI personality

### 3. **Query Cache** (`queryCache.js`)
   - **Purpose**: Reduce API calls by caching similar queries
   - **Storage**: Redis
   - **Features**:
     - Similarity detection (70% threshold)
     - Levenshtein distance + Jaccard similarity
     - Time-aware caching (different dates = different cache)
     - TTL: 1 hour

### 4. **Message Handler** (`messageHandler.js`)
   - **Purpose**: Handles Instagram DM messages
   - **Flow**: Database search → Perplexity fallback → Response formatting

## Complete Flow (Web Chat `/api/chat`)

```
1. User sends message
   ↓
2. Check cache (exact match or similarity search)
   ↓
3. If cache hit → return cached response
   ↓
4. If cache miss:
   a. Detect if it's an event query (keywords: event, concert, club, etc.)
   b. Parse date from query (today, tomorrow, specific date, day of week)
   ↓
5. Parallel data fetching:
   a. Search MongoDB database for events
   b. Query Perplexity API for real-time event data
   ↓
6. Combine results:
   - Database events (curated, verified)
   - Perplexity results (real-time web search with citations)
   ↓
7. Build context string with:
   - Perplexity event data + citations
   - Database events (name, date, location, link, price)
   ↓
8. Send to Gemini with:
   - System instruction (NYC Event AI personality)
   - Conversation history (last 10 messages)
   - Event context (from Perplexity + database)
   ↓
9. Gemini generates natural language response
   ↓
10. Cache the response (if event query)
   ↓
11. Return response to user with:
    - Formatted reply
    - Citations (from Perplexity)
    - Database events (structured data)
```

## Complete Flow (Instagram DM `/webhook`)

```
1. Instagram webhook receives message
   ↓
2. Mark message as seen, show typing indicator
   ↓
3. Search MongoDB database for events
   ↓
4. If database has events:
   → Format and return events
   ↓
5. If no database events:
   → Query Perplexity AI for general answer
   → Return AI response
   ↓
6. Save query to database (for analytics)
```

## Key Features

### 1. **Intelligent Caching**
   - Caches event queries for 1 hour
   - Similarity detection reuses cached results for similar queries
   - Date-aware: queries for different dates are cached separately
   - Uses Redis for persistence and multi-instance support

### 2. **Date Parsing**
   - Supports multiple date formats:
     - "August 7, 2025"
     - "Aug 7 2025"
     - "8/7/2025"
     - "today", "tomorrow"
     - Day names: "Friday", "Saturday", etc.
   - Defaults to "tomorrow" if no date specified

### 3. **Multi-Source Data Aggregation**
   - **MongoDB Database**: Curated events from Luma, Meetup, etc.
   - **Perplexity API**: Real-time web search with citations
   - Results combined and sent to Gemini for formatting

### 4. **Conversation Context**
   - Maintains conversation history per session (in-memory)
   - Last 10 messages kept (5 user + 5 AI)
   - Sessions expire after 1 hour of inactivity
   - Context passed to Gemini for coherent responses

### 5. **Response Formatting**
   - Gemini uses a detailed system prompt:
     - NYC Event AI personality (friendly, local, Gen Z tone)
     - Instructions to use only real event data
     - Format events with emojis (🕓 📍 💰 💡 🔗)
     - Never invent events
     - Use exact URLs from event data

## System Prompts

### Perplexity Prompt (Event Search)
```
Find real, upcoming events in New York City for: "{userQuery}"

Provide information about events including:
- Event name
- Date and time
- Venue/location
- Price (if available)
- Brief description

Focus on events happening soon (today, tomorrow, this week, this weekend).
Only include real events with actual dates and venues.
```

### Gemini System Prompt
```
You are NYC Event AI, a friendly and conversational city assistant built to help 
people instantly find what's happening today in New York City.

CRITICAL RULES:
1. DO NOT make up events - ONLY use events from provided data
2. DO NOT write "Not Available" - skip events without info
3. USE THE EXACT URLs from event data
4. If no events found, say: "I couldn't find verified events right now..."

Format events like:
Event Name
🕓 Date & Time
📍 Venue & Location
💰 Price
💡 Brief description
Platform: [Platform name]
🔗 [EXACT URL]
```

## API Configuration

### Required Environment Variables
- `PERPLEXITY_API_KEY`: For real-time web search
- `GEMINI_API_KEY`: For response generation
- `MONGODB_URI` or `MONGO_URI`: For database events
- `REDIS_URL` or `REDIS_HOST`: For caching (optional but recommended)
- `INSTAGRAM_ACCESS_TOKEN`: For Instagram DM (optional)
- `PAGE_ID`: For Instagram DM (optional)

## Performance Optimizations

1. **Parallel Data Fetching**: Database and Perplexity queries run simultaneously
2. **Caching**: Reduces API calls for similar queries
3. **Similarity Detection**: Reuses cached results for semantically similar queries
4. **Session Management**: In-memory conversation history (lightweight)
5. **Error Handling**: Graceful fallbacks if one data source fails

## Limitations

1. **Instagram Flow**: Simpler flow, doesn't use Gemini (only Perplexity fallback)
2. **Conversation History**: In-memory only (lost on server restart)
3. **Cache**: Requires Redis for persistence (fails gracefully if not available)
4. **Date Parsing**: Basic keyword-based (no advanced NLP)
5. **Event Detection**: Keyword-based (may miss some event queries)

## Future Improvements

1. Store conversation history in Redis/database
2. Use more advanced NLP for intent detection
3. Add more data sources (Eventbrite, Dice.fm, etc.)
4. Implement rate limiting for API calls
5. Add analytics dashboard for query patterns
6. Improve date parsing with NLP libraries

