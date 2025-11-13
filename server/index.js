import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import { connectDB } from './db/mongo.js';
import webhookRouter from './routes/instaWebhook.js';
import chatRouter from './routes/chat.js';
import testInstagramRouter from './routes/testInstagram.js';

// Import cache modules to ensure they initialize and show debug output
import './services/cacheLogger.js';
import './services/queryCache.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (privacy policy, terms, etc.)
app.use(express.static('public'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'NYC Scout - Events & Dining Assistant',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Instagram webhook routes
app.use('/webhook', webhookRouter);

// Chat API routes (for web interface)
app.use('/api', chatRouter);

// Test Instagram configuration
app.use('/test-instagram', testInstagramRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Webhook URL: http://localhost:${PORT}/webhook`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n📊 Debug logging is ENABLED - cache operations will be logged to terminal\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

