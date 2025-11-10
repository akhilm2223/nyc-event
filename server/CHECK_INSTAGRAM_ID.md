# 🔍 Quick Check: Do You Have the Right ID?

## The Problem

Your configuration shows:
- **PAGE_ID in .env**: `803714129500101` (Facebook Page ID)
- **What you might need**: Instagram Business Account ID

## How to Check

### Option 1: Refresh the Test Page
1. Make sure your server is running: `npm start`
2. Visit: http://localhost:3000/test-instagram
3. Look for the "Page & Instagram Account" test
4. If it shows an Instagram Business Account ID, **that's what you need!**

### Option 2: Run the Helper Script
```bash
node scripts/getInstagramId.js
```

This will show you:
- Your Facebook Page ID
- Your Instagram Business Account ID (if linked)
- What to use in your .env file

### Option 3: Manual Check
Visit this URL in your browser (replace YOUR_TOKEN):
```
https://graph.facebook.com/v18.0/803714129500101?fields=id,name,instagram_business_account{id,username}&access_token=YOUR_TOKEN
```

## What to Do Next

### If You Have an Instagram Business Account Linked:

Update your `.env` file:
```env
# Use the Instagram Business Account ID, not the Facebook Page ID
PAGE_ID=your_instagram_business_account_id_here
```

### If No Instagram Business Account is Linked:

You need to:
1. Convert your Instagram account to a Business account
2. Link it to your Facebook Page

**Steps:**
1. Open Instagram app
2. Go to Settings → Account → Switch to Professional Account
3. Choose Business
4. Connect to your Facebook Page "Nycevents"

## Test Message Sending

Once you have the right ID, test it:
```bash
node scripts/testSendMessage.js
```

This will try sending with both IDs and tell you which one works!

## Why This Matters

Instagram's API requires you to use the **Instagram Business Account ID** to send messages, not the Facebook Page ID. Even though they're linked, they're different entities in Meta's system.

Your webhook might be receiving messages fine (because it's subscribed correctly), but **sending replies** requires the correct Instagram Account ID.
