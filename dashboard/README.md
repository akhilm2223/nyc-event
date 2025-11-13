# 🎯 Event AI Dashboard

Beautiful React dashboard for monitoring your Instagram Event AI Assistant.

## 🚀 Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

## ✨ Features

- **Real-time Analytics** - View total queries, active users, events found
- **Recent Queries** - See all user queries with intent parsing
- **Event Categories** - Visual breakdown of popular event types
- **Beautiful UI** - Modern design with Tailwind CSS
- **Responsive** - Works on desktop and mobile

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx      # Main header
│   │   ├── Sidebar.jsx        # Navigation sidebar
│   │   ├── StatsCards.jsx     # Statistics cards
│   │   ├── RecentQueries.jsx  # Query list
│   │   └── EventAnalytics.jsx # Category breakdown
│   ├── App.jsx               # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css             # Tailwind styles
├── vite.config.js           # Vite configuration
└── tailwind.config.js       # Tailwind configuration
```

## 🔗 Connecting to Backend

The dashboard is configured to connect to your backend API at `http://localhost:3000`.

To fetch real data, update the API calls in `App.jsx`:

```javascript
useEffect(() => {
  fetch('http://localhost:3000/api/queries')
    .then(res => res.json())
    .then(data => setQueries(data))
}, [])
```

## 🎨 Customization

- **Colors**: Edit `tailwind.config.js` to change the color scheme
- **Components**: All components are in `src/components/`
- **Styling**: Uses Tailwind CSS utility classes

## 📦 Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🐛 Troubleshooting

**Dashboard not loading?**
- Make sure the backend server is running on port 3000
- Check browser console for errors

**Tailwind styles not working?**
- Make sure `postcss.config.js` and `tailwind.config.js` exist
- Restart the dev server

---

Built with ⚡️ Vite + ⚛️ React + 🎨 Tailwind CSS
