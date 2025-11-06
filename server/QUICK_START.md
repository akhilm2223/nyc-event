# 🚀 Quick Start - Get Running in 5 Minutes

## Step 1: Get Your Gemini API Key (Free)

1. Visit: **https://makersuite.google.com/app/apikey**
2. Sign in with Google
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy the key (starts with `AIza...`)

## Step 2: Add API Key to `.env`

Open `server/.env` and paste your key:

```env
GEMINI_API_KEY=AIzaSyC_your_actual_key_here
```

Save the file.

## Step 3: Test the AI (No Server Needed!)

```bash
cd server
node test-ai.js
```

You should see:
```
🧪 Testing AI Services
🧠 Parsing user intent...
✅ Parsed Intent: { category: "tech meetup", ... }
💬 Formatting response...
🤖 BOT RESPONSE:
"Here are 3 tech events I found 👇
💡 AI Builders Meetup..."
```

✅ **If this works, your AI is ready!**

---

## Step 4: Start the Full Server

```bash
npm run dev
```

You should see:
```
⚠️  MongoDB not configured - running without database
🚀 Server running on port 3000
📍 Webhook URL: http://localhost:3000/webhook
```

Open browser: **http://localhost:3000**

You should see:
```json
{
  "status": "online",
  "service": "Instagram Event AI Assistant"
}
```

---

## What's Working Now:

✅ Express server  
✅ Instagram webhook endpoints  
✅ Gemini AI for natural language understanding  
✅ Conversational response formatting  
⏳ MongoDB (optional - add later)  
⏳ Instagram API (setup next)  
⏳ Real event APIs (coming soon)  

---

## Next Steps:

### Option A: Connect Instagram (30 min setup)
1. Convert IG account to Professional
2. Create Facebook Page
3. Meta Developer Portal setup
4. Get access token
5. Use ngrok for webhooks

### Option B: Add Event APIs (Easier!)
1. Get Eventbrite API key
2. Get Meetup API key  
3. Integrate real event data

### Option C: Build Dashboard
1. React + Vite frontend
2. View user queries
3. Analytics & insights

---

## 🐛 Troubleshooting

**"GEMINI_API_KEY not found"**
- Make sure you edited `server/.env` (not `.env.example`)
- Check there are no spaces around the `=` sign
- Key should start with `AIza`

**Server won't start**
- Make sure you ran `npm install` first
- Check port 3000 isn't already in use
- Try `npm run dev` again

**API quota exceeded**
- Gemini free tier has limits
- Wait a few minutes and try again
- Or upgrade to paid tier

---

## 📚 Files Overview

```
server/
├── index.js              # Main server (Express)
├── test-ai.js           # Test AI without full server ⭐
├── .env                 # Your API keys (edit this!)
├── routes/
│   └── instaWebhook.js  # Instagram message handling
├── services/
│   ├── geminiService.js    # AI magic ✨
│   ├── instagramService.js # Send DMs
│   └── messageHandler.js   # Orchestration
└── db/
    └── mongo.js         # Database schemas
```

---

**Got it working? 🎉 You're ready for the next step!**

Let me know if you hit any issues.

