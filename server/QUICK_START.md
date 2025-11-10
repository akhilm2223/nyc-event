# 🚀 Quick Start - Instagram DM Bot

## ✅ What You Have
- Server code ready at `~/Desktop/cc/server`
- Webhook endpoint: `/webhook`
- Meta App ID: `24355790484095730`
- ngrok running with public URL

## 🎯 What You Need To Do

### 1. Get Your Credentials

Visit your Meta App Dashboard:
👉 https://developers.facebook.com/apps/24355790484095730

**Get App Secret:**
- Settings → Basic → Show App Secret

**Get Page Access Token:**
- Instagram → Basic Display → Generate Token

**Get Page ID:**
- Your Facebook Page → About → Page ID

### 2. Update `.env` File

```bash
cd ~/Desktop/cc/server
```

Edit `.env` and add:
```env
APP_SECRET=your_app_secret_from_dashboard
INSTAGRAM_ACCESS_TOKEN=EAAJxxxxx_your_token_here
PAGE_ID=your_page_id_here
```

### 3. Configure Webhook in Meta Dashboard

Go to: https://developers.facebook.com/apps/24355790484095730/webhooks/

**Callback URL:** `https://YOUR-NGROK-URL/webhook`
**Verify Token:** `my_event_ai_secret_verify_token_2024`

Subscribe to: `messages`, `messaging_postbacks`, `message_echoes`

### 4. Test It!

1. Make sure server is running:
   ```bash
   npm start
   ```

2. Make sure ngrok is running:
   ```bash
   ngrok http 3000
   ```

3. Send a DM to your Instagram Business account

4. Check server logs - you should see:
   ```
   📨 Received message from [user_id]:
      "your message"
   ✅ Message sent successfully
   ```

## 🔧 Troubleshooting

**Webhook verification fails?**
- Check ngrok URL is correct
- Verify token matches: `my_event_ai_secret_verify_token_2024`

**Not receiving messages?**
- Instagram account must be a Business account
- Facebook Page must be connected to Instagram
- Check webhook subscriptions are active

**Can't send replies?**
- Verify `INSTAGRAM_ACCESS_TOKEN` is set
- Check token hasn't expired
- Ensure you have `instagram_manage_messages` permission

## 📖 Full Documentation

See `INSTAGRAM_SETUP.md` for detailed setup instructions.
