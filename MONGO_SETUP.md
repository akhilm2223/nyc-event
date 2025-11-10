# NYC Event AI + MongoDB Atlas Quickstart

1. **Create a free MongoDB Atlas cluster**  
   - Go to https://www.mongodb.com/atlas/database  
   - Create a new project and deploy a Free (M0) cluster  
   - In Database Access, add a database user and password  
   - In Network Access, allow your IP (0.0.0.0/0 for testing)  
   - Grab the connection string (replace `<password>` with the user password)

2. **Add environment variables**  
   - Copy `mongo-env.example` to `.env`  
   - Set `MONGO_URI` to your Atlas connection string  
   - Set `OPENAI_API_KEY` if you plan to hit the API (optional)

3. **Install dependencies**

```bash
npm install
```

4. **Run the helper scripts**

```bash
npm run scrape   # insert mocked scraped events
npm run enrich   # generate mock AI summaries & tags for unsummarized events
npm run summary  # compute weekly stats and save to ai_summaries collection
```

All scripts use async/await, load `.env`, connect via Mongoose, and print results with `console.table()` for quick inspection.
