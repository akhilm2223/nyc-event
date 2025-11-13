import { connectDB } from '../db/mongo.js';
import Event from '../models/Event.js';
import dotenv from 'dotenv';

dotenv.config();

async function listAllEvents() {
  try {
    console.log('📋 Fetching all events from database...\n');
    
    await connectDB(true);
    
    // Get all events, sorted by date
    const events = await Event.find({}).sort({ date: 1, time: 1 });
    
    console.log(`✅ Found ${events.length} total events in database\n`);
    console.log('=' .repeat(80));
    
    // Group by source
    const bySource = {};
    events.forEach(event => {
      const source = event.source || 'Unknown';
      if (!bySource[source]) {
        bySource[source] = [];
      }
      bySource[source].push(event);
    });
    
    // Display by source
    for (const [source, sourceEvents] of Object.entries(bySource)) {
      console.log(`\n📦 ${source.toUpperCase()} (${sourceEvents.length} events)`);
      console.log('-'.repeat(80));
      
      sourceEvents.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.name}`);
        console.log(`   📅 ${event.date}${event.time ? ' at ' + event.time : ''}`);
        console.log(`   📍 ${event.location || 'Location TBD'}`);
        console.log(`   💰 ${event.price || 'Free'}`);
        console.log(`   🔗 ${event.link || 'No link'}`);
        if (event.category) {
          console.log(`   🏷️  ${event.category}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Summary by Source:');
    for (const [source, sourceEvents] of Object.entries(bySource)) {
      console.log(`   ${source}: ${sourceEvents.length} events`);
    }
    
    console.log(`\n✅ Total: ${events.length} events\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAllEvents();
