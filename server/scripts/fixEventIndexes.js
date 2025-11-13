import { connectDB } from '../db/mongo.js';
import Event from '../models/Event.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixIndexes() {
  try {
    console.log('🔧 Fixing Event collection indexes...\n');
    
    await connectDB(true);
    
    // Get current indexes
    const indexes = await Event.collection.getIndexes();
    console.log('Current indexes:', Object.keys(indexes));
    
    // Drop the problematic unique index if it exists
    if (indexes.title_1_date_1_location_1) {
      console.log('\n🗑️  Dropping old title_1_date_1_location_1 index...');
      await Event.collection.dropIndex('title_1_date_1_location_1');
      console.log('✅ Index dropped');
    }
    
    // Ensure correct indexes exist
    console.log('\n📊 Ensuring correct indexes...');
    await Event.collection.createIndex({ date: 1, source: 1 });
    await Event.collection.createIndex({ name: 'text', description: 'text' });
    
    console.log('✅ Indexes fixed!\n');
    
    const finalIndexes = await Event.collection.getIndexes();
    console.log('Final indexes:', Object.keys(finalIndexes));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIndexes();
