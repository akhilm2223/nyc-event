# 🔧 Troubleshooting Guide

## Fixed Issues

### 1. MongoDB Connection Errors
**Problem:** The server was trying to query MongoDB even when it wasn't connected, causing 500 errors.

**Fix:** Added connection checks before database queries:
- Check if `MONGODB_URI` or `MONGO_URI` is configured
- Check if mongoose connection is ready (`readyState === 1`)
- Return empty array if database is not available (graceful degradation)

### 2. Gemini API Error Handling
**Problem:** Unhandled errors from Gemini API were causing 500 errors.

**Fix:** Added comprehensive error handling:
- Check if API key is configured
- Validate response status
- Handle JSON parsing errors
- Validate response structure before accessing nested properties
- Provide detailed error messages in logs

### 3. Event Data Safety Checks
**Problem:** Accessing properties on potentially undefined/null objects.

**Fix:** Added null/undefined checks:
- Check if `eventData` and `eventData.content` exist before use
- Filter invalid events from `dbEvents` array
- Add default values for missing properties

### 4. Response Validation
**Problem:** No validation of API responses before accessing nested properties.

**Fix:** Added validation:
- Check if `contents` array is not empty before API call
- Validate response structure before accessing `candidates[0].content.parts[0].text`
- Better error messages for debugging

## How to Debug 500 Errors

### 1. Check Server Logs
Look at the server console output for detailed error messages:
```bash
cd server
npm run dev
```

The logs now include:
- ✅ Success messages with details
- ❌ Error messages with context
- ⚠️ Warnings for missing configurations

### 2. Check Environment Variables
Make sure your `.env` file has the required variables:
```bash
# Required for chat endpoint
GEMINI_API_KEY=your_key_here

# Optional (server works without these)
MONGODB_URI=your_mongodb_uri
PERPLEXITY_API_KEY=your_perplexity_key
```

### 3. Test Individual Endpoints

**Health Check:**
```bash
curl http://localhost:3000
```

**Chat Endpoint:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "events tonight", "sessionId": "test123"}'
```

### 4. Check API Keys

**Test Gemini API Key:**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

**Test Perplexity API Key:**
```bash
curl https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar","messages":[{"role":"user","content":"test"}]}'
```

### 5. Common Issues and Solutions

#### Issue: "GEMINI_API_KEY not configured"
**Solution:** Add `GEMINI_API_KEY` to your `.env` file

#### Issue: "Database not connected"
**Solution:** This is OK! The server works without MongoDB. If you need database features, add `MONGODB_URI` to `.env`

#### Issue: "Failed to connect to Gemini API"
**Solution:** 
- Check your internet connection
- Verify the API key is correct
- Check if you've exceeded API rate limits

#### Issue: "Invalid response from Gemini API"
**Solution:**
- Check API key permissions
- Verify you're using the correct model name
- Check API status at https://status.cloud.google.com/

#### Issue: Port 3000 already in use
**Solution:**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm run dev
```

### 6. Enable Detailed Logging

The server now logs detailed information:
- Data source being used (MongoDB, Perplexity API)
- Number of events found
- API response status
- Error messages with context

### 7. Check Browser Console

If using the dashboard, check browser console for:
- Network errors
- CORS errors
- API response errors

### 8. Verify Server is Running

```bash
# Check if server is running
curl http://localhost:3000

# Should return:
# {"status":"online","service":"Instagram Event AI Assistant",...}
```

## Still Getting 500 Errors?

1. **Check the exact error message** in server logs
2. **Verify all environment variables** are set correctly
3. **Test with a simple request** first (health check endpoint)
4. **Check API rate limits** - you might be hitting limits
5. **Verify network connectivity** - server needs internet for API calls

## Getting Help

If you're still experiencing issues:
1. Check server logs for the exact error message
2. Verify your `.env` file configuration
3. Test API keys individually
4. Check if the issue is with a specific endpoint or all endpoints

---

**Note:** The server is now more resilient and will:
- Work without MongoDB (graceful degradation)
- Provide detailed error messages
- Handle API failures gracefully
- Continue working even if some data sources fail

