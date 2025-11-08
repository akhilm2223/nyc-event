import cron from 'node-cron';
import { scrapeAllEvents } from './scrapeNYCEvents.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Schedule the scraper to run once per week (every Monday at 9:00 AM)
 * Cron format: minute hour day-of-month month day-of-week
 * 0 9 * * 1 = Every Monday at 9:00 AM
 */
const CRON_SCHEDULE = '0 9 * * 1'; // Every Monday at 9:00 AM

console.log('📅 NYC Events Scraper Scheduler');
console.log(`⏰ Schedule: Every Monday at 9:00 AM (${CRON_SCHEDULE})`);
console.log('🚀 Starting scheduler...\n');

// Run immediately on startup (optional - remove if you only want weekly runs)
console.log('🔄 Running initial scrape...');
scrapeAllEvents()
  .then(() => {
    console.log('✅ Initial scrape completed!\n');
  })
  .catch((error) => {
    console.error('❌ Initial scrape failed:', error);
  });

// Schedule weekly runs
const task = cron.schedule(CRON_SCHEDULE, async () => {
  console.log(`\n⏰ Scheduled scrape started at ${new Date().toISOString()}`);
  try {
    await scrapeAllEvents();
    console.log('✅ Scheduled scrape completed successfully!');
  } catch (error) {
    console.error('❌ Scheduled scrape failed:', error);
  }
}, {
  scheduled: true,
  timezone: "America/New_York" // NYC timezone
});

console.log('✅ Scheduler is running. The scraper will run every Monday at 9:00 AM EST.\n');
console.log('Press Ctrl+C to stop the scheduler.');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping scheduler...');
  task.stop();
  process.exit(0);
});

