import { researchNYCEventCounts, saveNYCEventResearch } from '../services/aiEventResearchService.js';

/**
 * CLI script to ask Perplexity + Gemini how many NYC events are happening.
 *
 * Usage:
 *   node scripts/queryAIEventCounts.js [timeframe]
 *
 * Examples:
 *   node scripts/queryAIEventCounts.js
 *   node scripts/queryAIEventCounts.js "this weekend"
 */

async function main() {
  const timeframeArg = process.argv.slice(2).join(' ').trim();
  const timeframe = timeframeArg || 'the next 7 days';

  console.log('\n🗽 NYC AI Event Research');
  console.log('----------------------------------------');
  console.log(`Timeframe: ${timeframe}`);

  try {
    const results = await researchNYCEventCounts({ timeframe });

    console.log('\n📈 Perplexity Insight:\n');
    console.log(results.perplexity || 'No response');

    console.log('\n🤖 Gemini Insight:\n');
    console.log(results.gemini || 'No response');

    await saveNYCEventResearch(results);

    console.log('\n✅ Research complete! Results saved to ai-nyc-event-counts.json\n');
  } catch (error) {
    console.error('\n❌ Failed to complete AI event research:', error.message);
    process.exit(1);
  }
}

main();
