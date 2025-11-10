# Instagram DM Chatbot Setup Guide

## 🎯 Overview
This guide will help you connect your Event AI chatbot to Instagram DMs using Meta's Graph API.

## 📋 Prerequisites
- ✅ Meta App ID: `24355790484095730`
- ✅ Instagram Business Account
- ✅ Facebook Page connected to your Instagram account
- ✅ ngrok installed and running

---

## 🚀 Step-by-Step Setup

### 1️⃣ Get Your ngrok Public URL

Your server is running on port 3000. Start ngrok:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://7a9b-xx-xx.ngrok-free.app`)

**Your webhook URL will be:** `https://YOUR-NGROK-URL/webhook`

---

### 2️⃣ Configure Meta App - Webhooks

1. Go to: https://developers.facebook.com/apps/24355790484095730/webhooks/
2. Click **"Add Subscription"** for **Instagram**
3. Enter:
   - **Callback URL**: `https://YOUR-NGROK-URL/webhook`
   - **Verify Token**: `my_event_ai_secret_verify_token_2024`
4. Subscribe to these fields:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `message_echoes`
5. Click **"Verify and Save"**

---

### 3️⃣ Get Your Page Access Token

1. Go to: https://developers.facebook.com/apps/24355790484095730/instagram-basic-display/basic-display/
2. Or navigate to: **App Dashboard → Products → Instagram → Basic Display**
3. Add your Instagram account
4. Generate a **Page Access Token**
5. Copy the token (starts with `EAAJxxxxx...`)

---

### 4️⃣ Update Your .env File

Add these values to `server/.env`:

```env
APP_ID=24355790484095730
APP_SECRET=your_app_secret_here
INSTAGRAM_ACCESS_TOKEN=EAAJxxxxx...
PAGE_ID=your_instagram_page_id
```

**To find your APP_SECRET:**
- Go to: https://developers.facebook.com/apps/24355790484095730/settings/basic/
- Click "Show" next to App Secret

**To find your PAGE_ID:**
- Go to your Facebook Page
- Click "About"
- Scroll to find Page ID

---

### 5️⃣ Grant Required Permissions

Your app needs these permissions:

- `instagram_basic`
- `instagram_manage_messages`
- `pages_manage_metadata`
- `pages_messaging`
- `pages_read_engagement`

**To add permissions:**
1. Go to: https://developers.facebook.com/apps/24355790484095730/app-review/permissions/
2. Request these permissions
3. For development/testing, you can use them immediately
4. For production, you'll need Meta's approval

---

### 6️⃣ Test Your Setup

1. **Start your server:**
   ```bash
   cd ~/Desktop/cc/server
   npm start
   ```

2. **Start ngrok** (in another terminal):
   ```bash
   ngrok http 3000
   ```

3. **Send a test message** to your Instagram Business account

4. **Check your server logs** - you should see:
   ```
   📨 Received message from [user_id]:
      "your message here"
   ```

---

## 🔍 Troubleshooting

### Webhook verification fails
- ✅ Make sure ngrok is running
- ✅ Check that `INSTAGRAM_VERIFY_TOKEN` in `.env` matches what you entered in Meta dashboard
- ✅ Ensure your server is running on port 3000

### Messages not received
- ✅ Check webhook subscriptions are active
- ✅ Verify your Instagram account is a Business account
- ✅ Make sure your Facebook Page is connected to Instagram
- ✅ Check server logs for errors

### Can't send replies
- ✅ Verify `PAGE_ACCESS_TOKEN` is correct
- ✅ Check token hasn't expired
- ✅ Ensure you have `instagram_manage_messages` permission

---

## 📚 Useful Links

- **Your App Dashboard**: https://developers.facebook.com/apps/24355790484095730
- **Instagram Graph API Docs**: https://developers.facebook.com/docs/instagram-api
- **Messenger Platform Docs**: https://developers.facebook.com/docs/messenger-platform
- **Webhook Reference**: https://developers.facebook.com/docs/graph-api/webhooks

---

## 🎉 Next Steps

Once webhooks are working:
1. Test event queries: "What's happening this weekend?"
2. Monitor rate limits in your Meta dashboard
3. When ready for production, deploy to Render/Railway instead of ngrok
4. Submit for App Review to go live

---

## 💡 Current Status

- ✅ Server code ready
- ✅ Webhook routes configured
- ✅ AI integration (Gemini + Perplexity) working
- ⏳ Need to configure Meta app credentials
- ⏳ Need to verify webhooks
- ⏳ Need to test end-to-end
