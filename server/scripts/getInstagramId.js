import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Helper script to get your Instagram Business Account ID
 * Run: node scripts/getInstagramId.js
 */

async function getInstagramBusinessAccountId() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const pageId = process.env.PAGE_ID;

  if (!accessToken) {
    console.error('❌ INSTAGRAM_ACCESS_TOKEN not found in .env');
    process.exit(1);
  }

  console.log('🔍 Fetching Instagram Business Account info...\n');

  try {
    // Method 1: Get from Page
    if (pageId) {
      console.log('📄 Method 1: Using PAGE_ID from .env');
      const pageUrl = `https://graph.facebook.com/v18.0/${pageId}`;
      const pageResponse = await axios.get(pageUrl, {
        params: {
          fields: 'id,name,instagram_business_account',
          access_token: accessToken
        }
      });

      console.log('Page Info:', pageResponse.data);
      
      if (pageResponse.data.instagram_business_account) {
        const igId = pageResponse.data.instagram_business_account.id;
        console.log('\n✅ Instagram Business Account ID:', igId);
        console.log('\n📝 Update your .env file:');
        console.log(`PAGE_ID=${igId}`);
        return;
      } else {
        console.log('⚠️ No Instagram Business Account linked to this page');
      }
    }

    // Method 2: Get from token
    console.log('\n📱 Method 2: Using access token directly');
    const meUrl = 'https://graph.facebook.com/v18.0/me';
    const meResponse = await axios.get(meUrl, {
      params: {
        fields: 'id,name,username',
        access_token: accessToken
      }
    });

    console.log('Account Info:', meResponse.data);
    console.log('\n✅ Use this as your PAGE_ID:', meResponse.data.id);
    console.log('\n📝 Update your .env file:');
    console.log(`PAGE_ID=${meResponse.data.id}`);

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure your access token is valid');
    console.log('2. Verify you have an Instagram Business Account');
    console.log('3. Check that your Facebook Page is connected to Instagram');
    console.log('4. Generate a new token at: https://developers.facebook.com/tools/explorer/');
  }
}

getInstagramBusinessAccountId();
