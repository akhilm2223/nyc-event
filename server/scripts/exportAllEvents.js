import { connectDB } from '../db/mongo.js';
import Event from '../models/Event.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function exportAllEvents() {
  try {
    console.log('📋 Exporting all events from database...\n');
    
    await connectDB(true);
    
    // Get all events, sorted by date
    const events = await Event.find({}).sort({ date: 1, time: 1 }).lean();
    
    console.log(`✅ Found ${events.length} total events\n`);
    
    // Create readable text output
    let output = `ALL EVENTS IN DATABASE (${events.length} total)\n`;
    output += '='.repeat(100) + '\n\n';
    
    // Group by source
    const bySource = {};
    events.forEach(event => {
      const source = event.source || 'Unknown';
      if (!bySource[source]) {
        bySource[source] = [];
      }
      bySource[source].push(event);
    });
    
    // Write each source
    for (const [source, sourceEvents] of Object.entries(bySource)) {
      output += `\n${'='.repeat(100)}\n`;
      output += `📦 ${source.toUpperCase()} - ${sourceEvents.length} EVENTS\n`;
      output += `${'='.repeat(100)}\n\n`;
      
      sourceEvents.forEach((event, index) => {
        output += `${index + 1}. ${event.name}\n`;
        output += `   📅 Date: ${event.date}${event.time ? ' at ' + event.time : ''}\n`;
        output += `   📍 Location: ${event.location || 'TBD'}\n`;
        output += `   💰 Price: ${event.price || 'Free'}\n`;
        output += `   🔗 Link: ${event.link || 'No link'}\n`;
        if (event.category) {
          output += `   🏷️  Category: ${event.category}\n`;
        }
        if (event.description) {
          output += `   📝 Description: ${event.description}\n`;
        }
        output += `   🆔 Platform: ${event.platform || source}\n`;
        output += '\n';
      });
    }
    
    output += '\n' + '='.repeat(100) + '\n';
    output += '📊 SUMMARY BY SOURCE:\n';
    output += '='.repeat(100) + '\n';
    for (const [source, sourceEvents] of Object.entries(bySource)) {
      output += `   ${source}: ${sourceEvents.length} events\n`;
    }
    output += `\n✅ TOTAL: ${events.length} events\n`;
    
    // Save to file
    const filename = 'all-events-export.txt';
    fs.writeFileSync(filename, output);
    
    console.log(`✅ Exported to ${filename}\n`);
    
    // Also save as JSON
    const jsonFilename = 'all-events-export.json';
    fs.writeFileSync(jsonFilename, JSON.stringify({ 
      totalEvents: events.length,
      exportDate: new Date().toISOString(),
      bySource: Object.entries(bySource).map(([source, events]) => ({
        source,
        count: events.length,
        events
      })),
      allEvents: events 
    }, null, 2));
    
    console.log(`✅ Also exported JSON to ${jsonFilename}\n`);
    
    // Print summary to console
    console.log('📊 Summary:');
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

exportAllEvents();
