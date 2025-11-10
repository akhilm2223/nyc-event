import axios from 'axios';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Test script to send a message via Instagram API
 * This helps debug message sending issues
 */

async function testSendMessage() {
  console.log('🧪 Instagram Message Send Test\n');

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const pageId = process.env.PAGE_ID;

  if (!accessToken || !pageId) {
    console.error('❌ Missing credentials in .env file');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`- PAGE_ID: ${pageId}`);
  console.log(`- Token: ${accessToken.substring(0, 20)}...`);
  console.log('');

  // First, get the Instagram Business Account ID
  try {
    console.log('🔍 Fetching Instagram Business Account...');
    const pageUrl = `https://graph.facebook.com/v18.0/${pageId}`;
    const pageResponse = await axios.get(pageUrl, {
      params: {
        fields: 'id,name,instagram_business_account{id,username}',
        access_token: accessToken
      }
    });

    console.log('✅ Page Info:', pageResponse.data);

    const igAccount = pageResponse.data.instagram_business_account;
    if (!igAccount) {
      console.error('\n❌ No Instagram Business Account linked to this page!');
      console.log('Fix: Link your Instagram Business Account to your Facebook Page');
      process.exit(1);
    }

    const igAccountId = igAccount.id;
    console.log(`\n✅ Instagram Account ID: ${igAccountId}`);
    console.log(`   Username: @${igAccount.username}`);

    // Ask for recipient ID
    rl.question('\n📝 Enter recipient Instagram ID (or press Enter to skip): ', async (recipientId) => {
      if (!recipientId || recipientId.trim() === '') {
        console.log('\n💡 To test, send a DM to your Instagram account first.');
        console.log('   Then check server logs for the sender ID.');
        rl.close();
        return;
      }

      // Try sending with both IDs
      console.log('\n🧪 Test 1: Sending with Facebook Page ID...');
      try {
        await sendMessage(pageId, recipientId, 'Test message from Page ID', accessToken);
        console.log('✅ Success with Page ID!');
      } catch (error) {
        console.log('❌ Failed with Page ID:', error.response?.data?.error?.message || error.message);
      }

      console.log('\n🧪 Test 2: Sending with Instagram Account ID...');
      try {
        await sendMessage(igAccountId, recipientId, 'Test message from IG Account ID', accessToken);
        console.log('✅ Success with Instagram Account ID!');
      } catch (error) {
        console.log('❌ Failed with IG Account ID:', error.response?.data?.error?.message || error.message);
      }

      console.log('\n📝 Update your .env with the ID that worked!');
      rl.close();
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    rl.close();
  }
}

async function sendMessage(senderId, recipientId, text, accessToken) {
  const url = `https://graph.facebook.com/v18.0/${senderId}/messages`;
  const payload = {
    recipient: { id: recipientId },
    message: { text },
    access_token: accessToken
  };
  
  const response = await axios.post(url, payload);
  return response.data;
}

testSendMessage();
