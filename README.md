# NYC Event AI Bot

Instagram bot that helps users discover free events in NYC.

## Quick Start

1. Install dependencies:
```bash
cd server
npm install
```

2. Configure `.env` file with your credentials

3. (Optional) Set up Redis for caching:
   - **Recommended**: Each developer runs Redis locally on their machine
   - **Alternative**: Use a cloud Redis service for shared cache (see [REDIS_SETUP.md](./REDIS_SETUP.md))
   - **Skip Redis**: App works without it, just no caching
   - See [SETUP_FOR_DEVELOPERS.md](./SETUP_FOR_DEVELOPERS.md) for step-by-step setup

4. Run the bot:
```bash
npm run dev
```

## Key Files

### Core Application
- `server/index.js` - Main server entry point
- `server/routes/chat.js` - Chat message handling
- `server/routes/instaWebhook.js` - Instagram webhook
- `server/models/Event.js` - Event database model
- `server/db/mongo.js` - MongoDB connection

### Services
- `server/services/perplexityService.js` - Perplexity AI integration
- `server/services/instagramService.js` - Instagram API
- `server/services/messageHandler.js` - Instagram message handler

### Scripts
- `server/scripts/importEventbriteEvents.js` - Import Eventbrite events
- `server/scripts/importLumaEvents.js` - Import Luma events
- `server/scripts/importMeetupEvents.js` - Import Meetup events
- `server/scripts/exportAllEvents.js` - Export all events to JSON/TXT
- `server/scripts/listAllEvents.js` - List all events in database
- `server/scripts/fixEventIndexes.js` - Fix database indexes

## Features

- 🔍 Searches database first (150+ curated events)
- 🌐 Falls back to Perplexity AI for additional events
- 💬 Instagram DM integration
- 🌐 Web chat interface (dashboard)
- 📊 MongoDB for event storage
- ⚡ Redis caching (optional) - reduces API calls by caching similar queries

## Environment Variables

Required:
- `MONGODB_URI` or `MONGO_URI` - MongoDB connection string
- `PERPLEXITY_API_KEY` - Perplexity AI API key
- `GEMINI_API_KEY` - Google Gemini API key

Optional:
- `REDIS_URL` - Redis connection URL (e.g., `redis://localhost:6379`)
- `REDIS_HOST` - Redis host (defaults to `localhost`)
- `REDIS_PORT` - Redis port (defaults to `6379`)
- `INSTAGRAM_ACCESS_TOKEN` - For Instagram DM integration
- `PAGE_ID` - Instagram page ID

## Import Events

```bash
cd server
npm run import:meetup
```

## List Events

```bash
cd server
npm run list:events
```

## Export Events

```bash
cd server
npm run export:events
```
