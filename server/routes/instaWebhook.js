import express from 'express';
import { handleIncomingMessage } from '../services/messageHandler.js';

const router = express.Router();

/**
 * GET /webhook - Webhook verification for Instagram
 * Meta will call this endpoint to verify your webhook URL
 */
router.get('/', (req, res) => {
  const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
  
  // Parse params from the webhook verification request
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log('✅ Webhook verified successfully!');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      console.log('❌ Webhook verification failed!');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

/**
 * POST /webhook - Receive Instagram messages
 * This endpoint receives incoming messages from Instagram
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    
    // Log the full webhook payload for debugging
    console.log('\n🔔 Webhook received:');
    console.log(JSON.stringify(body, null, 2));
    
    // Check if this is an event from Instagram
    if (body.object === 'instagram') {
      // Return 200 OK immediately to acknowledge receipt
      res.sendStatus(200);
      
      // Process each entry in the webhook payload
      body.entry.forEach(async (entry) => {
        // Instagram can send different webhook formats
        // Try messaging format first (for DMs)
        const webhookEvent = entry.messaging?.[0];
        
        if (webhookEvent) {
          // Get sender ID
          const senderId = webhookEvent.sender.id;
          
          // Check if this is a message event
          if (webhookEvent.message) {
            const messageText = webhookEvent.message.text;
            
            console.log(`\n📨 Received message from ${senderId}:`);
            console.log(`   "${messageText}"`);
            
            // Handle the message (process with AI and respond)
            await handleIncomingMessage(senderId, messageText);
          }
        } else {
          // Check for changes format (comments, mentions, etc.)
          const changes = entry.changes;
          if (changes) {
            console.log('📝 Received changes event (not a DM):', changes);
          } else {
            console.log('⚠️ Unknown webhook format - no messaging or changes found');
          }
        }
      });
    } else {
      // Not from Instagram, return 404 Not Found
      console.log('❌ Webhook not from Instagram, object:', body.object);
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.sendStatus(500);
  }
});

export default router;

