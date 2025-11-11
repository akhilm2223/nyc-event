import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event from '../models/Event.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory
dotenv.config({ path: join(__dirname, '../.env') });

async function importLumaEvents() {
  try {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Read the JSON file
    const filePath = join(__dirname, '../../manual-import-templates/luma-events-nov2025.json');
    const fileContent = readFileSync(filePath, 'utf-8');
    const events = JSON.parse(fileContent);

    console.log(`📋 Found ${events.length} Luma events to import\n`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const eventData of events) {
      try {
        // Check if event already exists (by name, date, and platform)
        const existing = await Event.findOne({
          name: eventData.name,
          date: eventData.date,
          platform: 'Luma'
        });

        if (existing) {
          // Update existing event
          await Event.updateOne(
            { _id: existing._id },
            {
              $set: {
                ...eventData,
                isActive: true,
                updatedAt: new Date()
              }
            }
          );
          updated++;
          console.log(`🔄 Updated: ${eventData.name}`);
        } else {
          // Create new event
          const newEvent = new Event({
            ...eventData,
            isActive: true
          });
          await newEvent.save();
          imported++;
          console.log(`✅ Imported: ${eventData.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing "${eventData.name}":`, error.message);
        skipped++;
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Imported: ${imported} new events`);
    console.log(`   🔄 Updated: ${updated} existing events`);
    console.log(`   ❌ Skipped: ${skipped} events (errors)`);
    console.log(`   📦 Total processed: ${events.length} events`);

    await mongoose.disconnect();
    console.log('\n✅ Done! Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the import
importLumaEvents();
