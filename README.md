# NYC Event AI Bot

Instagram bot that helps users discover free events in NYC.

## Quick Start

1. Install dependencies:
```bash
cd server
npm install
```

2. Configure `.env` file with your credentials

3. Run the bot:
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
- `server/services/geminiService.js` - Gemini AI for scraping

### Scripts
- `server/scripts/manualEventImport.js` - Import events from JSON
- `server/scripts/replaceAllEvents.js` - Replace all database events
- `server/scripts/cleanupDatabase.js` - Clean up old events
- `server/scripts/scrapeReliableSources.js` - Scrape GoodRec, Luma, Meetup
- `server/scripts/scheduleAllScrapers.js` - Daily scraper scheduler

### Data
- `manual-import-templates/nycforfree-events-complete.json` - NYC for FREE events (87 events)

## Features

- 🔍 Searches database first (87 curated NYC for FREE events)
- 🌐 Falls back to Perplexity AI for additional events
- 🤖 Scrapes GoodRec, Luma, and Meetup for real-time events
- 💬 Instagram DM integration
- 📊 MongoDB for event storage

## Import Events

```bash
cd server
node scripts/manualEventImport.js ../manual-import-templates/nycforfree-events-complete.json
```

## Replace All Events

```bash
cd server
node scripts/replaceAllEvents.js ../manual-import-templates/nycforfree-events-complete.json
```
