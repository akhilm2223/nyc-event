import { sendInstagramMessage, sendTypingIndicator, markMessageSeen } from './instagramService.js';
import { Query, User } from '../db/mongo.js';
import { queryPerplexity } from './perplexityService.js';
import Event from '../models/Event.js';

/**
 * Main handler for incoming Instagram messages
 * This orchestrates the entire flow: parse -> fetch events -> format -> respond
 */
export const handleIncomingMessage = async (senderId, messageText) => {
  try {
    console.log(`\n🤖 Processing message from ${senderId}: "${messageText}"`);
    
    // Mark message as seen
    await markMessageSeen(senderId);
    
    // Show typing indicator
    await sendTypingIndicator(senderId, true);
    
    // Update user stats
    await updateUserStats(senderId);
    
    // Step 1: Search database for events
    console.log('🔍 Searching database for events...');
    const dbEvents = await searchDatabaseEvents(messageText);
    
    let response = '';
    
    // Step 2: Query Perplexity AI if no database results
    if (dbEvents.length > 0) {
      console.log(`✅ Found ${dbEvents.length} events in database`);
      response = formatEventsResponse(dbEvents, messageText);
      
      // Ensure total length is under 2000 chars (Instagram limit)
      if (response.length > 1900) {
        response = response.substring(0, 1900) + '...';
      }
      
      // Save query to database
      await saveQuery(senderId, messageText, {}, dbEvents, response);
    } else {
      console.log('📭 No events found in database, querying Perplexity AI...');
      
      let aiResponse = '';
      try {
        aiResponse = await queryPerplexity(messageText);
        console.log('💬 AI Response received');
      } catch (aiError) {
        console.error('⚠️ Perplexity AI error:', aiError.message);
      }
      
      if (aiResponse) {
        const aiPreview = aiResponse.length > 1800 ? aiResponse.substring(0, 1800) + '...' : aiResponse;
        response = `📭 No events in my curated list, but here's what I found:\n\n${aiPreview}`;
      } else {
        response = `Sorry, I couldn't find any events matching "${messageText}". Try searching for something else! 🔍`;
      }
      
      // Save query to database
      await saveQuery(senderId, messageText, {}, [], response);
    }
    
    // Send response
    await sendInstagramMessage(senderId, response);
    
    // Turn off typing indicator
    await sendTypingIndicator(senderId, false);
    
    console.log('✅ Message handled successfully');
    
  } catch (error) {
    console.error('❌ Error handling message:', error);
    
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
    // Skip if MongoDB not connected (check both MONGODB_URI and MONGO_URI)
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri || mongoUri.trim() === '') {
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
    // Skip if MongoDB not connected (check both MONGODB_URI and MONGO_URI)
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri || mongoUri.trim() === '') {
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

/**
 * Search database for events matching the query
 */
const searchDatabaseEvents = async (query) => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri || mongoUri.trim() === '') {
      return [];
    }
    
    // Create search regex for flexible matching
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    // Search in name, description, category, and location
    const events = await Event.find({
      $or: [
        { name: { $regex: searchTerms.join('|'), $options: 'i' } },
        { description: { $regex: searchTerms.join('|'), $options: 'i' } },
        { category: { $regex: searchTerms.join('|'), $options: 'i' } },
        { location: { $regex: searchTerms.join('|'), $options: 'i' } }
      ],
      isActive: true
    })
    .sort({ date: 1 })
    .limit(10);
    
    return events;
  } catch (error) {
    console.error('Error searching database:', error);
    return [];
  }
};

/**
 * Format events into a readable response
 */
const formatEventsResponse = (events, query) => {
  if (events.length === 0) {
    return `I couldn't find any events matching "${query}" in my database. Let me search online for you...`;
  }
  
  let response = `🎉 Found ${events.length} free event${events.length > 1 ? 's' : ''} for you!\n\n`;
  
  events.slice(0, 5).forEach((event, index) => {
    response += `${index + 1}. ${event.name}\n`;
    response += `📅 ${event.date}`;
    if (event.time) response += ` at ${event.time}`;
    response += `\n`;
    if (event.location) response += `📍 ${event.location}\n`;
    if (event.category) response += `🏷️ ${event.category}\n`;
    if (event.link) response += `🔗 ${event.link}\n`;
    response += `\n`;
  });
  
  if (events.length > 5) {
    response += `...and ${events.length - 5} more events!\n`;
  }
  
  response += `\nAll events are FREE! 🎊`;
  
  return response;
};

