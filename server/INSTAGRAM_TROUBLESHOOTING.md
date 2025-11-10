# Instagram Webhook Troubleshooting Guide

## 🔧 Quick Diagnostic Steps

### Step 1: Test Your Configuration
1. Start your server: `npm start`
2. Visit: `http://localhost:3000/test-instagram`
3. Review all test results - they should all show ✅ PASS

### Step 2: Common Issues & Fixes

#### ❌ Webhook Verification Fails
**Symptoms:** Meta dashboard shows "Callback verification failed"

**Solutions:**
- Ensure ngrok is running: `ngrok http 3000`
- Verify token in `.env` matches Meta dashboard exactly
- Check server logs for the verification request
- Make sure URL is: `https://YOUR-NGROK-URL/webhook` (not `/webhooks`)

#### ❌ Messages Not Received
**Symptoms:** Send DM to Instagram but nothing happens

**Possible Causes:**

1. **Wrong Account Type**
   - Must be Instagram **Business** or **Creator** account
   - Personal accounts don't support messaging API
   - Fix: Convert to Business account in Instagram settings

2. **Page Not Connected**
   - Facebook Page must be connected to Instagram Business account
   - Fix: Go to Instagram Settings → Business → Linked Accounts → Facebook

3. **Wrong Webhook Subscriptions**
   - Must subscribe to `messages` field
   - Go to: https://developers.facebook.com/apps/24355790484095730/webhooks/
   - Click "Edit" on Instagram subscription
   - Ensure `messages` is checked

4. **Wrong PAGE_ID**
   - You need the Instagram Business Account ID, not Facebook Page ID
   - Get it from: `https://graph.facebook.com/v18.0/me?fields=id,username&access_token=YOUR_TOKEN`
   - Or use the test endpoint to find it

#### ❌ Can't Send Replies
**Symptoms:** Receive messages but can't respond

**Solutions:**

1. **Token Expired**
   - Page tokens expire after 60 days
   - Generate new token: https://developers.facebook.com/tools/explorer/
   - Select your Page → Generate Access Token
   - Update `INSTAGRAM_ACCESS_TOKEN` in `.env`

2. **Missing Permissions**
   Required permissions:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_messaging`
   
   Check permissions at: https://developers.facebook.com/apps/24355790484095730/app-review/permissions/

3. **Wrong API Endpoint**
   - For Instagram: `https://graph.facebook.com/v18.0/{ig-user-id}/messages`
   - NOT the Facebook Page messages endpoint

#### ❌ Rate Limited
**Symptoms:** Error 613 or "Rate limit exceeded"

**Solutions:**
- Check rate limit usage: https://developers.facebook.com/apps/24355790484095730/dashboard/
- You're at 4% usage, so this shouldn't be the issue
- If hitting limits, implement message queuing

### Step 3: Verify Webhook Payload

When you send a test message, check server logs for:

```json
{
  "object": "instagram",
  "entry": [{
    "id": "instagram-account-id",
    "time": 1234567890,
    "messaging": [{
      "sender": { "id": "sender-id" },
      "recipient": { "id": "your-ig-id" },
      "timestamp": 1234567890,
      "message": {
        "mid": "message-id",
        "text": "Hello!"
      }
    }]
  }]
}
```

If you see this structure, webhooks are working!

### Step 4: Test Message Flow

1. **Send test message** to your Instagram Business account
2. **Check server logs** - should see:
   ```
   🔔 Webhook received:
   📨 Received message from [sender-id]:
      "your message"
   ✅ Message sent successfully
   ```

3. **Check Instagram** - you should receive a reply

## 🔍 Debug Mode

To see full webhook payloads, the updated webhook handler now logs everything.

Check your server console for detailed webhook data.

## 📋 Checklist Before Going Live

- [ ] Instagram Business Account connected to Facebook Page
- [ ] Webhook verified and subscribed to `messages`
- [ ] Access token valid and has correct permissions
- [ ] Test messages working end-to-end
- [ ] Privacy Policy URL set: https://YOUR-DOMAIN/privacy.html
- [ ] Terms of Service URL set: https://YOUR-DOMAIN/terms.html
- [ ] App submitted for review (if needed)

## 🆘 Still Not Working?

1. Run the test endpoint: `http://localhost:3000/test-instagram`
2. Check all tests pass
3. Review server logs when sending test message
4. Check Meta App Dashboard for errors
5. Verify Instagram account is Business type

## 📚 Useful Commands

```bash
# Start server
npm start

# Start ngrok
ngrok http 3000

# Test webhook locally
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"instagram","entry":[{"messaging":[{"sender":{"id":"test"},"message":{"text":"test"}}]}]}'

# Check if server is running
curl http://localhost:3000
```

## 🔗 Quick Links

- **App Dashboard**: https://developers.facebook.com/apps/24355790484095730
- **Webhooks Config**: https://developers.facebook.com/apps/24355790484095730/webhooks/
- **Permissions**: https://developers.facebook.com/apps/24355790484095730/app-review/permissions/
- **Access Token Tool**: https://developers.facebook.com/tools/explorer/
- **Instagram API Docs**: https://developers.facebook.com/docs/instagram-api/guides/messaging
