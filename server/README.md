# Instagram Event AI Assistant - Backend

AI-powered event discovery assistant that lives inside Instagram DMs.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `MONGODB_URI` - MongoDB connection string
- `GEMINI_API_KEY` - Google Gemini API key
- `INSTAGRAM_ACCESS_TOKEN` - Instagram Graph API access token
- `INSTAGRAM_VERIFY_TOKEN` - Custom verification token (you create this)
- `PAGE_ID` - Facebook Page ID linked to your Instagram account

### 3. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## 🔗 Setting Up Instagram Webhook

### Step 1: Use ngrok for local testing

```bash
ngrok http 3000
```

This gives you a public URL like: `https://abc123.ngrok.io`

### Step 2: Configure Meta Developer Portal

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app (Business type)
3. Add Instagram product
4. Set webhook URL: `https://abc123.ngrok.io/webhook`
5. Set verify token (same as `INSTAGRAM_VERIFY_TOKEN` in your .env)
6. Subscribe to `messages` webhook events

### Step 3: Test the Webhook

Send a test message to your Instagram account. You should see logs in your terminal.

## 📁 Project Structure

```
server/
├── index.js                 # Main server file
├── routes/
│   └── instaWebhook.js     # Instagram webhook endpoints
├── services/
│   ├── messageHandler.js   # Core message processing logic
│   ├── geminiService.js    # AI processing with Gemini
│   └── instagramService.js # Instagram API interactions
├── db/
│   └── mongo.js            # MongoDB connection & schemas
├── .env.example            # Environment variables template
└── package.json            # Dependencies
```

## 🔑 API Endpoints

### GET /
Health check endpoint
```json
{
  "status": "online",
  "service": "Instagram Event AI Assistant",
  "version": "1.0.0"
}
```

### GET /webhook
Instagram webhook verification endpoint (Meta will call this)

### POST /webhook
Receives incoming Instagram messages

## 🗄️ Database Schemas

### Query Schema
Stores user queries and results
```javascript
{
  userId: String,
  query: String,
  parsedIntent: {
    category: String,
    date: String,
    location: String,
    keywords: [String]
  },
  results: [Event],
  responseText: String,
  timestamp: Date
}
```

### User Schema
Stores user preferences and stats
```javascript
{
  instagramId: String,
  preferences: {
    favoriteCategories: [String],
    defaultLocation: String
  },
  stats: {
    totalQueries: Number,
    lastActive: Date
  }
}
```

### EventCache Schema
Caches event data to reduce API calls
```javascript
{
  eventId: String,
  source: String,
  title: String,
  date: Date,
  venue: String,
  cachedAt: Date // Auto-expires after 24 hours
}
```

## 🛠️ Next Steps

1. ✅ Basic server setup (DONE)
2. 🔄 Add event API integrations (Eventbrite, Meetup, etc.)
3. ⏳ Build React dashboard for analytics
4. ⏳ Add ticket booking features
5. ⏳ Deploy to production

## 📝 Notes

- Currently using mock event data
- Gemini API handles natural language understanding
- Messages are processed asynchronously
- Database queries are logged for analytics

## 🐛 Troubleshooting

**Webhook not receiving messages?**
- Check that ngrok is running
- Verify webhook URL in Meta Developer Portal
- Ensure verify token matches in both places

**MongoDB connection issues?**
- Verify MONGODB_URI is correct
- Check that your IP is whitelisted in MongoDB Atlas

**Gemini API errors?**
- Verify GEMINI_API_KEY is valid
- Check API quota limits

## 📚 Resources

- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Gemini API Docs](https://ai.google.dev/docs)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/)

