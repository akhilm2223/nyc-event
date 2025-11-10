import { enrichAndSaveEvents } from '../services/eventEnrichmentService.js';

/**
 * Script to enrich events from events.json using Perplexity + Gemini
 * 
 * Usage:
 *   node server/scripts/enrichEvents.js [limit]
 * 
 * Examples:
 *   node server/scripts/enrichEvents.js       # Process all events
 *   node server/scripts/enrichEvents.js 5     # Process only 5 events (for testing)
 */

async function main() {
  try {
    // Get limit from command line args if provided
    const limit = process.argv[2] ? parseInt(process.argv[2]) : null;

    if (limit) {
      console.log(`\n⚠️ LIMIT SET: Processing only ${limit} events for testing\n`);
    } else {
      console.log('\n📊 Processing ALL events from events.json\n');
    }

    // Run the enrichment process
    await enrichAndSaveEvents(limit);

    console.log('\n✨ All done! Check enriched-events.json for results.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

