# 🚀 How to Run NYC Event AI Bot

This project consists of two parts:
1. **Server** - Backend API and Instagram webhook handler
2. **Dashboard** - React frontend (optional)

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB (optional - server can run without it for development)
- Environment variables configured

## Step 1: Install Server Dependencies

```bash
cd server
npm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cd server
touch .env
```

Add the following variables to `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB (optional - server can run without it)
MONGODB_URI=your_mongodb_connection_string
# OR
MONGO_URI=your_mongodb_connection_string

# Instagram API (required for Instagram webhook)
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
PAGE_ID=your_instagram_page_id
APP_ID=your_facebook_app_id
APP_SECRET=your_facebook_app_secret
INSTAGRAM_VERIFY_TOKEN=your_verify_token

# AI Services
PERPLEXITY_API_KEY=your_perplexity_api_key
GEMINI_API_KEY=your_gemini_api_key

# Optional APIs
EVENTBRITE_API_KEY=your_eventbrite_api_key
```

**Note:** The server can run in development mode without all these variables. Only add the ones you need.

## Step 3: Run the Server

```bash
# From the server directory
npm run dev
```

Or for production:

```bash
npm start
```

The server will start on `http://localhost:3000`

## Step 4: (Optional) Run the Dashboard

In a new terminal:

```bash
cd dashboard
npm install
npm run dev
```

The dashboard will start on `http://localhost:5173`

## Quick Test

1. **Check server status:**
   ```bash
   curl http://localhost:3000
   ```

2. **Test Instagram configuration:**
   ```bash
   curl http://localhost:3000/test-instagram
   ```

3. **Check webhook endpoint:**
   ```bash
   curl http://localhost:3000/webhook
   ```

## Common Issues

### Server won't start
- Make sure port 3000 is not already in use
- Check that all required environment variables are set
- MongoDB is optional - server will run without it

### MongoDB connection errors
- The server can run without MongoDB in development mode
- To enable database features, add `MONGODB_URI` to your `.env` file

### Instagram webhook not working
- Make sure `INSTAGRAM_ACCESS_TOKEN`, `PAGE_ID`, `APP_ID`, and `APP_SECRET` are set
- Verify your webhook URL is accessible (use ngrok for local development)
- Check the verify token matches your Instagram app configuration

## Development Mode

The server is configured to be developer-friendly:
- Runs without MongoDB (database features disabled)
- Detailed error messages in development
- Hot reload with nodemon (`npm run dev`)

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Ensure all required environment variables are set
3. Use `npm start` instead of `npm run dev`
4. Set up proper MongoDB connection
5. Configure Instagram webhook with a public URL (not localhost)

---

For more details, see the main [README.md](./README.md)

