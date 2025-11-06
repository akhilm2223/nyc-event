import axios from 'axios';

const INSTAGRAM_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a message to an Instagram user via DM
 */
export const sendInstagramMessage = async (recipientId, messageText) => {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const pageId = process.env.PAGE_ID;
    
    if (!accessToken || !pageId) {
      throw new Error('Instagram credentials not configured');
    }
    
    const url = `${INSTAGRAM_API_URL}/${pageId}/messages`;
    
    const payload = {
      recipient: {
        id: recipientId
      },
      message: {
        text: messageText
      },
      access_token: accessToken
    };
    
    const response = await axios.post(url, payload);
    
    console.log('✅ Message sent successfully to', recipientId);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending Instagram message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send a typing indicator to show the bot is processing
 */
export const sendTypingIndicator = async (recipientId, isTyping = true) => {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const pageId = process.env.PAGE_ID;
    
    if (!accessToken || !pageId) {
      return; // Silently fail if not configured
    }
    
    const url = `${INSTAGRAM_API_URL}/${pageId}/messages`;
    
    const payload = {
      recipient: {
        id: recipientId
      },
      sender_action: isTyping ? 'typing_on' : 'typing_off',
      access_token: accessToken
    };
    
    await axios.post(url, payload);
    
  } catch (error) {
    console.error('Error sending typing indicator:', error.response?.data || error.message);
    // Don't throw - typing indicator is not critical
  }
};

/**
 * Mark message as seen
 */
export const markMessageSeen = async (recipientId) => {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const pageId = process.env.PAGE_ID;
    
    if (!accessToken || !pageId) {
      return;
    }
    
    const url = `${INSTAGRAM_API_URL}/${pageId}/messages`;
    
    const payload = {
      recipient: {
        id: recipientId
      },
      sender_action: 'mark_seen',
      access_token: accessToken
    };
    
    await axios.post(url, payload);
    
  } catch (error) {
    console.error('Error marking message as seen:', error.response?.data || error.message);
  }
};

