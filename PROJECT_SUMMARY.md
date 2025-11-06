# 🎯 Instagram Event AI Assistant - Project Summary

## What You Have Built

### 1. **Backend Server** (Node.js + Express)
- ✅ Instagram webhook integration for DM handling
- ✅ Gemini AI for natural language understanding
- ✅ MongoDB schemas for queries, users, and events
- ✅ Chat API endpoint for web interface
- ✅ Event search with AI fallback

**Location:** `server/`
**Port:** `http://localhost:3000`

### 2. **Frontend Dashboard** (React + Vite + Tailwind)

#### Admin Dashboard (`/dashboard`)
- ✅ Real-time analytics
- ✅ Stats cards (Total Queries, Active Users, Events Found, Response Time)
- ✅ Recent queries list with intent parsing
- ✅ Top event categories visualization
- ✅ Dark/black theme throughout

#### Chat Interface (`/chat`)
- ✅ Beautiful dark-themed chat UI
- ✅ Real-time messaging with Event AI
- ✅ Typing indicators
- ✅ Event cards with ticket links
- ✅ Auto-scroll messages
- ✅ Category icons (🎵 🏈 💡 🎨 🍕)

**Location:** `dashboard/`
**Port:** `http://localhost:5173`

---

## 🗺️ Navigation

| URL | Purpose |
|-----|---------|
| `http://localhost:5173/` | Redirects to `/chat` |
| `http://localhost:5173/chat` | User-facing chat interface |
| `http://localhost:5173/dashboard` | Admin analytics panel |
| `http://localhost:3000` | Backend API health check |
| `http://localhost:3000/webhook` | Instagram webhook endpoint |
| `http://localhost:3000/api/chat` | Web chat API endpoint |

---

## 📂 Project Structure

```
cc/
├── server/                      # Backend (Node.js + Express)
│   ├── index.js                # Main server
│   ├── routes/
│   │   ├── instaWebhook.js    # Instagram DM handling
│   │   └── chat.js            # Web chat endpoint
│   ├── services/
│   │   ├── geminiService.js   # AI processing
│   │   ├── instagramService.js # Send Instagram DMs
│   │   └── messageHandler.js  # Message orchestration
│   ├── db/
│   │   └── mongo.js           # Database schemas
│   └── .env                    # API keys (not in git)
│
└── dashboard/                   # Frontend (React + Vite)
    ├── src/
    │   ├── pages/
    │   │   ├── Chat.jsx        # Chat interface
    │   │   └── DashboardPage.jsx # Admin dashboard
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── StatsCards.jsx
    │   │   ├── RecentQueries.jsx
    │   │   └── EventAnalytics.jsx
    │   ├── App.jsx             # Router
    │   └── index.css           # Tailwind styles
    └── package.json
```

---

## 🚀 How to Run

### Start Backend
```bash
cd server
npm run dev
```
✅ Server runs on `http://localhost:3000`

### Start Frontend
```bash
cd dashboard
npm run dev
```
✅ Dashboard runs on `http://localhost:5173`

---

## 🎨 Features

### Chat Interface (`/chat`)
- 💬 Talk to Event AI like ChatGPT
- 🎯 Get event recommendations
- 📍 Location-aware responses
- 🎫 Event cards with ticket links
- ⚡ Real-time typing indicators
- 🌑 Beautiful dark UI

### Admin Dashboard (`/dashboard`)
- 📊 Usage statistics
- 👥 User analytics
- 💬 Recent query logs
- 📈 Category breakdown
- 🔄 Real-time updates

---

## 🔑 Environment Setup

### Required API Keys

Add these to `server/.env`:

1. **Gemini API Key** (Required)
   - Get from: https://makersuite.google.com/app/apikey
   - Used for: AI chat responses

2. **MongoDB URI** (Optional - runs without DB in dev mode)
   - Get from: https://www.mongodb.com/cloud/atlas
   - Used for: Storing queries and analytics

3. **Instagram API** (Optional - for Instagram DM integration)
   - Setup via Meta Developer Portal
   - Used for: Receiving DMs on Instagram

---

## 🧪 Testing

### Test the Chat Interface
1. Go to `http://localhost:5173/chat`
2. Try: "Any tech meetups in NYC this weekend?"
3. Watch AI respond with event suggestions

### Test the Dashboard
1. Go to `http://localhost:5173/dashboard`
2. View analytics and recent queries
3. Navigate between pages using sidebar

### Test Backend
```bash
curl http://localhost:3000
```

---

## 🎯 Current Status

✅ **Completed:**
- Backend server with Express
- Instagram webhook endpoints
- Gemini AI integration
- MongoDB schemas
- Chat interface (beautiful dark UI)
- Admin dashboard (analytics)
- Routing between pages

⏳ **Pending:**
- Real event API integrations (Eventbrite, Meetup, Ticketmaster)
- Instagram account connection
- MongoDB setup (optional)
- Production deployment

---

## 📝 Next Steps

### Phase 1: Test Everything
1. Add Gemini API key to `server/.env`
2. Test chat at `/chat`
3. Test dashboard at `/dashboard`

### Phase 2: Add Real Event APIs
1. Get Eventbrite API key
2. Integrate in `server/services/eventService.js`
3. Replace AI search with real event data

### Phase 3: Connect Instagram
1. Convert Instagram account to Professional
2. Create Facebook Page
3. Setup Meta Developer App
4. Configure webhook to receive DMs

### Phase 4: Deploy
1. Deploy backend to Render/Railway
2. Deploy frontend to Vercel/Netlify
3. Connect custom domain

---

## 🌐 Live Demo Flow

**User Journey:**

1. User visits `yourdomain.com` → Lands on `/chat`
2. User asks: "Any concerts in Brooklyn tonight?"
3. AI processes query with Gemini
4. Backend searches events (currently via AI, later via APIs)
5. Response appears in chat with event cards
6. User can click "Get Tickets" to book

**Admin Journey:**

1. You visit `yourdomain.com/dashboard`
2. View total queries, active users, stats
3. See what people are asking about
4. Monitor popular event categories
5. Track system performance

---

## 🎨 Design Theme

- **Primary:** Black (`#000000`)
- **Secondary:** Dark Gray (`#111827` - gray-900)
- **Accent:** Purple (`#9333EA` - purple-600)
- **Text:** White + Gray-400
- **Borders:** Gray-800

---

## 🐛 Troubleshooting

**Chat not responding?**
- Make sure backend is running on port 3000
- Check Gemini API key is set in `.env`
- Look for errors in terminal

**Dashboard not loading?**
- Make sure frontend is running on port 5173
- Check browser console for errors
- Try `npm install` if packages are missing

**Routing not working?**
- Clear browser cache
- Check that `react-router-dom` is installed
- Restart dev server

---

## 📚 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Backend | Node.js + Express |
| AI | Google Gemini 2.0 Flash |
| Database | MongoDB (optional) |
| Messaging | Instagram Graph API |

---

**Built with ❤️ — Your Instagram Event AI Assistant is ready!** 🚀

