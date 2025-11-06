import { parseUserIntent, formatEventResponse } from './geminiService.js';
import { sendInstagramMessage, sendTypingIndicator, markMessageSeen } from './instagramService.js';
import { Query, User } from '../db/mongo.js';

/**
 * Main handler for incoming Instagram messages
 * This orchestrates the entire flow: parse -> fetch events -> format -> respond
 */
export const handleIncomingMessage = async (senderId, messageText) => {
  try {
    // Mark message as seen
    await markMessageSeen(senderId);
    
    // Show typing indicator
    await sendTypingIndicator(senderId, true);
    
    // Update user stats
    await updateUserStats(senderId);
    
    // Parse the user's intent using Gemini
    const intent = await parseUserIntent(messageText);
    
    // For now, we'll create a mock response until we add event APIs
    // This will be replaced in the next step with actual event fetching
    const mockEvents = [
      {
        title: "Jets vs Giants",
        date: new Date(),
        time: "7:00 PM",
        venue: "MetLife Stadium",
        address: "East Rutherford, NJ",
        ticketLink: "https://example.com/tickets"
      }
    ];
    
    // Generate conversational response
    const responseText = await formatEventResponse(mockEvents, messageText);
    
    // Save query to database
    await saveQuery(senderId, messageText, intent, mockEvents, responseText);
    
    // Send response
    await sendInstagramMessage(senderId, responseText);
    
    // Turn off typing indicator
    await sendTypingIndicator(senderId, false);
    
    console.log('✅ Message handled successfully');
    
  } catch (error) {
    console.error('Error handling message:', error);
    
    // Send error message to user
    try {
      await sendInstagramMessage(
        senderId,
        "Sorry, I'm having trouble right now. Please try again in a moment! 🙏"
      );
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
};

/**
 * Save query and results to database
 */
const saveQuery = async (userId, queryText, intent, events, responseText) => {
  try {
    // Skip if MongoDB not connected
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.trim() === '') {
      console.log('💾 Query logged (DB not configured)');
      return;
    }
    
    const query = new Query({
      userId,
      query: queryText,
      parsedIntent: intent,
      results: events,
      responseText,
      responded: true
    });
    
    await query.save();
    console.log('💾 Query saved to database');
    
  } catch (error) {
    console.error('Error saving query:', error);
  }
};

/**
 * Update user stats
 */
const updateUserStats = async (instagramId) => {
  try {
    // Skip if MongoDB not connected
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.trim() === '') {
      return;
    }
    
    await User.findOneAndUpdate(
      { instagramId },
      {
        $inc: { 'stats.totalQueries': 1 },
        $set: { 'stats.lastActive': new Date() }
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

