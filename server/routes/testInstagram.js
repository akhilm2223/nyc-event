import express from 'express';
import axios from 'axios';

const router = express.Router();

/**
 * Test endpoint to verify Instagram API configuration
 * Visit: http://localhost:3000/test-instagram
 */
router.get('/', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Check environment variables
  results.tests.push({
    name: 'Environment Variables',
    status: process.env.INSTAGRAM_ACCESS_TOKEN && process.env.PAGE_ID ? '✅ PASS' : '❌ FAIL',
    details: {
      hasAccessToken: !!process.env.INSTAGRAM_ACCESS_TOKEN,
      hasPageId: !!process.env.PAGE_ID,
      hasAppId: !!process.env.APP_ID,
      hasAppSecret: !!process.env.APP_SECRET,
      tokenPreview: process.env.INSTAGRAM_ACCESS_TOKEN ? 
        process.env.INSTAGRAM_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT SET'
    }
  });

  // Test 2: Verify Page Access Token
  if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.PAGE_ID) {
    try {
      const tokenDebugUrl = `https://graph.facebook.com/v18.0/debug_token`;
      const tokenDebugResponse = await axios.get(tokenDebugUrl, {
        params: {
          input_token: process.env.INSTAGRAM_ACCESS_TOKEN,
          access_token: `${process.env.APP_ID}|${process.env.APP_SECRET}`
        }
      });

      results.tests.push({
        name: 'Access Token Validation',
        status: tokenDebugResponse.data.data.is_valid ? '✅ PASS' : '❌ FAIL',
        details: {
          isValid: tokenDebugResponse.data.data.is_valid,
          appId: tokenDebugResponse.data.data.app_id,
          expiresAt: tokenDebugResponse.data.data.expires_at,
          scopes: tokenDebugResponse.data.data.scopes
        }
      });
    } catch (error) {
      results.tests.push({
        name: 'Access Token Validation',
        status: '❌ FAIL',
        error: error.response?.data || error.message
      });
    }

    // Test 3: Get Page Info and Instagram Business Account
    try {
      const pageUrl = `https://graph.facebook.com/v18.0/${process.env.PAGE_ID}`;
      const pageResponse = await axios.get(pageUrl, {
        params: {
          fields: 'id,name,instagram_business_account{id,username,name}',
          access_token: process.env.INSTAGRAM_ACCESS_TOKEN
        }
      });

      const hasIgAccount = !!pageResponse.data.instagram_business_account;
      const igAccountId = pageResponse.data.instagram_business_account?.id;

      results.tests.push({
        name: 'Page & Instagram Account',
        status: hasIgAccount ? '✅ PASS' : '⚠️ WARNING',
        details: {
          facebookPage: {
            id: pageResponse.data.id,
            name: pageResponse.data.name
          },
          instagramBusinessAccount: pageResponse.data.instagram_business_account || 'NOT LINKED',
          recommendation: hasIgAccount ? 
            `Use Instagram Account ID (${igAccountId}) for sending messages` :
            'Link an Instagram Business Account to this Facebook Page'
        }
      });
    } catch (error) {
      results.tests.push({
        name: 'Page & Instagram Account',
        status: '❌ FAIL',
        error: error.response?.data || error.message
      });
    }

    // Test 4: Check Webhook Subscriptions
    try {
      const subscriptionsUrl = `https://graph.facebook.com/v18.0/${process.env.APP_ID}/subscriptions`;
      const subscriptionsResponse = await axios.get(subscriptionsUrl, {
        params: {
          access_token: `${process.env.APP_ID}|${process.env.APP_SECRET}`
        }
      });

      results.tests.push({
        name: 'Webhook Subscriptions',
        status: subscriptionsResponse.data.data.length > 0 ? '✅ PASS' : '⚠️ WARNING',
        details: subscriptionsResponse.data.data
      });
    } catch (error) {
      results.tests.push({
        name: 'Webhook Subscriptions',
        status: '❌ FAIL',
        error: error.response?.data || error.message
      });
    }
  }

  // Generate HTML report
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Instagram API Test Results</title>
  <style>
    body { font-family: system-ui; max-width: 900px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .test { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .pass { border-left: 4px solid #22c55e; }
    .fail { border-left: 4px solid #ef4444; }
    .warning { border-left: 4px solid #f59e0b; }
    pre { background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .status { font-size: 24px; font-weight: bold; }
    .timestamp { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🔍 Instagram API Configuration Test</h1>
  <p class="timestamp">Test run: ${results.timestamp}</p>
  
  ${results.tests.map(test => `
    <div class="test ${test.status.includes('✅') ? 'pass' : test.status.includes('⚠️') ? 'warning' : 'fail'}">
      <div class="status">${test.status}</div>
      <h2>${test.name}</h2>
      ${test.details ? `<pre>${JSON.stringify(test.details, null, 2)}</pre>` : ''}
      ${test.error ? `<pre style="color: #ef4444;">${JSON.stringify(test.error, null, 2)}</pre>` : ''}
    </div>
  `).join('')}
  
  <div style="margin-top: 40px; padding: 20px; background: #e0f2fe; border-radius: 8px;">
    <h3>📚 Next Steps:</h3>
    <ol>
      <li>If any tests failed, check your .env file configuration</li>
      <li>Verify your Instagram Business Account is connected to your Facebook Page</li>
      <li>Make sure webhook subscriptions include "messages" field</li>
      <li>Test by sending a DM to your Instagram Business account</li>
    </ol>
    <p><strong>Webhook URL:</strong> <code>https://YOUR-NGROK-URL/webhook</code></p>
    <p><strong>Verify Token:</strong> <code>${process.env.INSTAGRAM_VERIFY_TOKEN || 'NOT SET'}</code></p>
  </div>
</body>
</html>
  `;

  res.send(html);
});

export default router;
