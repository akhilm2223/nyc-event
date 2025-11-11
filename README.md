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
