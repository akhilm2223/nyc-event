# NYC Events Scraper

This scraper collects events from two sources for New York City:

1. **GoodRec Volleyball** - https://www.goodrec.com/play-volleyball/new-york-city
2. **NYC for FREE** - https://www.nycforfree.co/events

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Make sure your `.env` file has `GEMINI_API_KEY` configured (required for event extraction).

## Usage

### Run Once (Manual)

To scrape events once and save to `nyc-events.json`:

```bash
cd server
npm run scrape:nyc
```

### Schedule Weekly Runs

To run the scraper automatically every Monday at 9:00 AM EST:

```bash
cd server
npm run scrape:schedule
```

This will:
- Run an initial scrape immediately
- Schedule weekly runs every Monday at 9:00 AM EST
- Keep running until you stop it (Ctrl+C)

### Alternative: System Cron (Linux/Mac)

You can also use system cron instead of the Node.js scheduler:

```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9:00 AM)
0 9 * * 1 cd /path/to/project/server && npm run scrape:nyc
```

### Windows Task Scheduler

For Windows, you can use Task Scheduler to run:
```
node server/scripts/scrapeNYCEvents.js
```
Set it to run weekly on Mondays at 9:00 AM.

## Output

Events are saved to `nyc-events.json` in the project root with the following format:

```json
[
  {
    "name": "Event Name",
    "date": "Friday, August 1, 2025",
    "time": "04:00 PM",
    "location": "Greenpoint, Brooklyn",
    "link": "https://www.goodrec.com/play-volleyball/new-york-city"
  }
]
```

## Features

- **Deduplication**: Automatically merges new events with existing ones, removing duplicates
- **NYC Only**: Filters out events outside New York City (excludes New Jersey, etc.)
- **Event Extraction**: Uses AI (Gemini) to extract structured event data from dynamic pages
- **Error Handling**: Continues scraping even if one source fails

## Notes

- The scraper uses Puppeteer to handle JavaScript-rendered content
- Events are merged intelligently - duplicates are detected by name, date, and location similarity
- The JSON file is excluded from git (see `.gitignore`)

