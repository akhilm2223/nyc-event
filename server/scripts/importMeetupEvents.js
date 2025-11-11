import { connectDB } from '../db/mongo.js';
import Event from '../models/Event.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Import Meetup events from JSON file into MongoDB
 * Usage: node server/scripts/importMeetupEvents.js
 */
async function importMeetupEvents() {
  try {
    console.log('🚀 Starting Meetup events import...\n');
    
    // Connect to MongoDB (throw error if fails)
    await connectDB(true);
    
    // Check if MongoDB is actually connected
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection failed. Check your MONGO_URI in .env file.');
    }
    
    console.log('✅ Ready to import events\n');
    
    // Read JSON file
    const filePath = path.join(__dirname, '../../manual-import-templates/meetup-events-template.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    console.log(`📂 Loaded ${data.events.length} events from JSON file`);
    console.log(`📅 Import date: ${data.importDate}`);
    console.log(`🔗 Source: ${data.source}\n`);
    
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    
    for (const eventData of data.events) {
      try {
        // Check if event already exists (by name and date)
        const existing = await Event.findOne({
          name: eventData.name,
          date: eventData.date
        });
        
        if (existing) {
          // Update existing event
          await Event.updateOne(
            { _id: existing._id },
            {
              $set: {
                time: eventData.time,
                location: eventData.location,
                description: eventData.description,
                link: eventData.link,
                category: eventData.category,
                price: eventData.price || 'Free',
                source: data.source,
                platform: data.platform,
                isActive: true,
                scrapedAt: new Date()
              }
            }
          );
          updated++;
          console.log(`✏️  Updated: ${eventData.name}`);
        } else {
          // Create new event
          const event = new Event({
            name: eventData.name,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            description: eventData.description,
            link: eventData.link,
            category: eventData.category,
            price: eventData.price || 'Free',
            source: data.source,
            platform: data.platform,
            isActive: true
          });
          
          await event.save();
          imported++;
          console.log(`✅ Imported: ${eventData.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing event "${eventData.name}":`, error.message);
        skipped++;
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Imported: ${imported} new events`);
    console.log(`   ✏️  Updated: ${updated} existing events`);
    console.log(`   ❌ Skipped: ${skipped} events (errors)`);
    console.log(`   📦 Total processed: ${data.events.length} events\n`);
    
    console.log('✅ Import completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importMeetupEvents();
