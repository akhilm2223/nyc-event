# NYC Scout - Project Overview

## What is NYC Scout?

NYC Scout is an AI-powered conversational assistant that helps people discover events and restaurants in New York City. It combines curated database content with real-time AI search to provide personalized recommendations through a friendly chat interface.

## Core Features

### 1. Event Discovery
- Search for concerts, meetups, tech events, sports, nightlife, and more
- Database of 150+ curated events from platforms like Meetup, Luma, Eventbrite
- Real-time web search via Perplexity AI for additional events
- Date-aware search (today, tomorrow, specific dates, weekdays)
- Smart caching to reduce API calls and improve response times

### 2. Restaurant Recommendations
- Database of NYC restaurants with Google Places data
- Search by cuisine type (Chinese, Italian, Japanese, Mexican, etc.)
- Filter by rating, price level, and location
- Detailed information including reviews, hours, phone, website
- AI-generated recommendations based on review summaries
- Conversational follow-up for refining searches

### 3. Intelligent Caching
- Redis-based query caching with similarity detection
- Reuses cached results for similar queries (70% similarity threshold)
- Reduces redundant API calls and improves response speed
- Shared cache across all users and server instances
- 1-hour TTL (time-to-live) for cached results

### 4. Multi-Channel Access
- Web chat interface (React dashboard)
- Instagram DM integration (webhook-based)
- Session-based conversation history
- Context-aware responses

## Architecture

### Backend (Node.js/Express)
```
server/
├── index.js                 # Main server entry point
├── routes/
│   ├── chat.js             # Chat API endpoint (web interface)
│   ├── instaWebhook.js     # Instagram webhook handler
│   └── testInstagram.js    # Instagram config testing
├── services/
│   ├── perplexityService.js    # Perplexity AI integration
│   ├── restaurantService.js    # Restaurant search logic
│   ├── queryCache.js           # Redis caching with similarity
│   ├── cacheLogger.js          # Cache operation logging
│   ├── messageHandler.js       # Instagram message processing
│   └── instagramService.js     # Instagram API client
├── models/
│   ├── Event.js            # MongoDB event schema
│   └── Restaurant.js       # MongoDB restaurant schema
├── db/
│   └── mongo.js            # MongoDB connection
└── scripts/
    ├── importMeetupEvents.js   # Import events from Meetup
    ├── importLumaEvents.js     # Import events from Luma
    ├── importEventbriteEvents.js
    ├── listAllEvents.js        # List database events
    └── exportAllEvents.js      # Export events to JSON/TXT
```

### Frontend (React/Vite)
```
dashboard/
├── src/
│   ├── pages/
│   │   └── Chat.jsx        # Main chat interface
│   ├── App.jsx
│   └── main.jsx
├── public/
│   └── textured.glb        # 3D model for landing page
└── vite.config.js
```

### Data Sources
1. **MongoDB Database** (Primary)
   - 150+ curated events from Meetup, Luma, Eventbrite
   - NYC restaurant data with Google Places integration
   - Indexed for fast text search

2. **Perplexity AI** (Secondary)
   - Real-time web search for additional events
   - Returns content with source citations
   - Used when database results are insufficient

3. **Google Gemini** (AI Response Generation)
   - Formats responses in conversational tone
   - Maintains conversation context
   - Generates personalized recommendations

## Key Technologies

### Backend
- **Node.js** + **Express** - Server framework
- **MongoDB** + **Mongoose** - Database and ODM
- **Redis** - Query caching and similarity matching
- **Perplexity API** - Real-time event search
- **Google Gemini API** - AI response generation
- **Instagram Graph API** - DM integration

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Three.js** + **React Three Fiber** - 3D graphics
- **Axios** - HTTP client

### Data Processing
- **Puppeteer** - Web scraping (for event imports)
- **Python scripts** - Restaurant data enrichment

## Data Flow

### Event Query Flow
```
User Query
    ↓
Chat Endpoint (/api/chat)
    ↓
Check Redis Cache (similarity matching)
    ↓ (cache miss)
Parallel Search:
    ├── MongoDB Database (curated events)
    └── Perplexity API (real-time search)
    ↓
Combine Results
    ↓
Format with Gemini AI
    ↓
Cache Response (Redis)
    ↓
Return to User
```

### Restaurant Query Flow
```
User Query
    ↓
Detect Restaurant Intent
    ↓
Extract Cuisine/Filters
    ↓
Search MongoDB (restaurants collection)
    ↓
Apply Filters (rating, price, location)
    ↓
Format with Review Summaries
    ↓
Generate AI Recommendations
    ↓
Return with Pagination Support
```

## Environment Configuration

### Required Variables
```env
# Database
MONGODB_URI=mongodb://...
MONGO_URI=mongodb://...  # Alternative name

# AI Services
GEMINI_API_KEY=your_gemini_key
PERPLEXITY_API_KEY=your_perplexity_key

# Caching (Required)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379

# Instagram (Optional)
INSTAGRAM_ACCESS_TOKEN=your_token
PAGE_ID=your_page_id
```

### Optional Features
- **Redis**: Required for caching (app works without it but no caching)
- **Instagram**: Optional for DM integration
- **Perplexity**: Optional (falls back to database-only search)

## Conversation System

### Session Management
- Each user gets a unique session ID
- Conversation history stored in-memory (last 10 messages)
- Context maintained across multiple queries
- Sessions expire after 1 hour of inactivity

### Restaurant Context Tracking
- Tracks active restaurant searches
- Remembers cuisine preferences
- Supports conversational follow-ups:
  - "Show me more"
  - "Filter by rating"
  - "Show me cheap options"
  - "Highly rated places"

### Event Context
- Date extraction from natural language
- Supports: "today", "tomorrow", "this Friday", "August 7, 2025"
- Caches results by query + date combination

## Caching Strategy

### Similarity Detection
- Normalizes queries (lowercase, remove punctuation)
- Calculates Levenshtein distance + Jaccard similarity
- Combines: 40% Levenshtein + 60% Jaccard
- Adjusts for time context differences
- Threshold: 70% similarity

### Cache Keys
```
Format: query:{normalized_query}_date:{YYYY-MM-DD}
Example: query:tech meetups_date:2025-11-13
```

### Cache Behavior
- Exact match: Instant return
- Similar match (≥70%): Reuse cached result
- Cache miss: Fetch fresh data and cache
- TTL: 1 hour
- Shared across all users

## API Endpoints

### Chat API
```
POST /api/chat
Body: { message: string, sessionId?: string }
Response: {
  reply: string,
  sessionId: string,
  historyLength: number,
  citations: string[],
  dbEvents: Event[],
  restaurants: Restaurant[],
  cached?: boolean
}
```

### Instagram Webhook
```
GET /webhook?hub.mode=subscribe&hub.verify_token=...
POST /webhook
Body: Instagram webhook payload
```

### Health Check
```
GET /
Response: { status, service, version, timestamp }
```

## Database Schemas

### Event Schema
```javascript
{
  name: String (required),
  date: String (required),
  time: String,
  location: String,
  description: String,
  link: String,
  price: String,
  source: String (required),  // GoodRec, The Skint, etc.
  platform: String,           // Eventbrite, Luma, Meetup
  isActive: Boolean,
  timestamps: true
}
```

### Restaurant Schema
```javascript
{
  Name: String (required),
  fullAddress: String,
  cuisineDescription: String,
  rating: Number,
  priceLevel: String,
  userRatingsTotal: Number,
  matchedName: String,
  matchedAddress: String,
  googleLatitude: Number,
  googleLongitude: Number,
  phoneNumber: String,
  website: String,
  businessStatus: String,
  googleMapsUri: String,
  googleTypes: [String],
  openingHours: [String],
  reviewSummary: String,
  googlePlaceId: String,
  lastUpdated: Date,
  timestamps: true
}
```

## Scripts & Commands

### Development
```bash
npm run dev          # Start server with nodemon
npm start            # Start server (production)
```

### Event Management
```bash
npm run import:meetup    # Import Meetup events
npm run list:events      # List all events
npm run export:events    # Export events to JSON/TXT
npm run fix:indexes      # Fix database indexes
```

### Restaurant Data
```bash
python import_restaurants_to_mongo.py           # Import restaurants
python fetch_restaurant_details_with_reviews.py # Enrich with Google data
python refetch_null_place_ids.py               # Fix missing Place IDs
```

## AI Personality

NYC Scout uses a friendly, conversational tone:
- Speaks like a local NYC friend
- Uses modern, Gen Z-friendly language
- Provides direct recommendations without fluff
- Remembers conversation context
- Asks clarifying questions when needed
- Formats responses with emojis and structure

### Response Format
```
Event Name
🕓 Date & Time
📍 Venue & Location
💰 Price
💡 Brief description
Platform: Luma/Meetup/etc.
🔗 Event URL
```

## Performance Optimizations

1. **Parallel Data Fetching**
   - Database and API searches run simultaneously
   - Reduces total query time

2. **Smart Caching**
   - Similarity matching reduces redundant API calls
   - Shared cache benefits all users
   - 1-hour TTL balances freshness and performance

3. **Database Indexing**
   - Text indexes on name, description, category
   - Compound indexes for common queries
   - Optimized for date-based searches

4. **Frontend Optimization**
   - 3D model preloading
   - Lazy loading for chat messages
   - Responsive design for mobile

## Future Enhancements

### Planned Features
- User accounts and saved preferences
- Personalized recommendations based on history
- Event reminders and notifications
- Social features (share events, invite friends)
- More data sources (Dice.fm, Resident Advisor, etc.)
- Advanced filters (distance, accessibility, etc.)

### Technical Improvements
- Persistent conversation storage (MongoDB)
- Vector embeddings for better similarity matching
- Real-time event updates via webhooks
- GraphQL API for flexible queries
- Microservices architecture for scalability

## Development Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or cloud)
- Redis (local or cloud)
- Python 3.8+ (for data scripts)

### Quick Start
1. Clone repository
2. Install dependencies: `cd server && npm install`
3. Configure `.env` file
4. Start Redis: `redis-server`
5. Start MongoDB
6. Run server: `npm run dev`
7. (Optional) Start dashboard: `cd dashboard && npm run dev`

### Testing
- Test Instagram config: `http://localhost:3000/test-instagram`
- Test chat API: POST to `http://localhost:3000/api/chat`
- Check cache stats: Monitor console logs

## Deployment

### Server Requirements
- Node.js runtime
- MongoDB connection
- Redis instance
- Environment variables configured

### Recommended Setup
- **Server**: Railway, Render, or AWS EC2
- **Database**: MongoDB Atlas
- **Cache**: Redis Cloud or AWS ElastiCache
- **Frontend**: Vercel or Netlify

### Production Considerations
- Enable HTTPS
- Set up monitoring (logs, errors, performance)
- Configure rate limiting
- Implement backup strategy
- Set up CI/CD pipeline

## Monitoring & Debugging

### Cache Logging
- Debug mode enabled by default
- Logs cache hits/misses to console
- Shows similarity scores for debugging
- Tracks cache size and expiration

### Error Handling
- Graceful fallbacks for API failures
- Cache operations don't block requests
- Detailed error logging
- User-friendly error messages

### Health Checks
- Server status endpoint
- MongoDB connection monitoring
- Redis connection monitoring
- API key validation

## Contributing

### Code Style
- ES6+ JavaScript
- Async/await for promises
- Descriptive variable names
- Comments for complex logic

### Git Workflow
- Feature branches
- Descriptive commit messages
- Pull requests for review
- Keep commits atomic

## License & Credits

Built with:
- OpenAI GPT models
- Google Gemini API
- Perplexity AI
- MongoDB
- Redis
- React & Three.js

---

**Last Updated**: November 2025
**Version**: 1.0.0
**Status**: Active Development