#!/bin/bash

# Load environment variables
source .env

CURRENT_NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)

if [ -z "$CURRENT_NGROK_URL" ]; then
    echo "❌ Could not get ngrok URL. Is ngrok running?"
    exit 1
fi

echo "🔄 Updating Instagram webhook..."
echo "   New URL: $CURRENT_NGROK_URL/webhook"

# Update Instagram webhook
curl -X POST "https://graph.facebook.com/v18.0/$APP_ID/subscriptions" \
  -d "object=instagram" \
  -d "callback_url=$CURRENT_NGROK_URL/webhook" \
  -d "fields=messages,messaging_postbacks,messaging_seen,message_edit,message_reactions" \
  -d "verify_token=$INSTAGRAM_VERIFY_TOKEN" \
  -d "access_token=$APP_ID|$APP_SECRET" \
  | python3 -m json.tool

echo ""
echo "✅ Webhook update request sent!"
