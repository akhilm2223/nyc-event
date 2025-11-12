#!/bin/bash
echo "🔍 Monitoring webhook activity..."
echo "📍 Current ngrok URL:"
curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); print('   ' + data['tunnels'][0]['public_url'] + '/webhook')"
echo ""
echo "📊 Recent requests (refreshing every 2 seconds):"
echo "   Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "🔍 Webhook Activity Monitor"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    curl -s http://127.0.0.1:4040/api/requests/http | python3 -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
requests = data.get('requests', [])[:10]

if not requests:
    print('   No requests yet. Send a DM to your Instagram account!')
else:
    for i, r in enumerate(requests):
        req = r.get('request', {})
        method = req.get('method', 'N/A')
        uri = req.get('uri', '')[:50]
        status = r.get('response', {}).get('status_code', 'N/A')
        ua = req.get('headers', {}).get('User-Agent', [''])[0]
        
        icon = '📱' if 'facebook' in ua.lower() else '🧪'
        status_icon = '✅' if str(status).startswith('2') else '❌'
        
        print(f'{i+1}. {icon} {method} {uri}')
        print(f'   {status_icon} Status: {status}')
        if 'facebook' in ua.lower():
            print(f'   ⭐ FROM INSTAGRAM!')
        print()
" 2>/dev/null || echo "   Error reading webhook data"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Last updated: $(date '+%H:%M:%S')"
    sleep 2
done
