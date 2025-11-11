import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas
 */
export const connectDB = async (throwOnError = false) => {
  try {
    // Check both MONGODB_URI and MONGO_URI for compatibility
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoURI || mongoURI.trim() === '') {
      const message = 'MongoDB not configured - Add MONGO_URI to .env file';
      if (throwOnError) {
        throw new Error(message);
      }
      console.log('⚠️  ' + message + ' (development mode)');
      return;
    }
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    if (throwOnError) {
      throw error;
    }
    console.log('⚠️  Continuing without database...');
  }
};

/**
 * Query Schema - Store user queries and results
 */
const querySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  query: {
    type: String,
    required: true
  },
  parsedIntent: {
    category: String,
    date: String,
    location: String,
    keywords: [String]
  },
  results: [{
    title: String,
    description: String,
    date: Date,
    time: String,
    venue: String,
    address: String,
    ticketLink: String,
    source: String,
    imageUrl: String
  }],
  responseText: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  responded: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
querySchema.index({ userId: 1, timestamp: -1 });
querySchema.index({ 'parsedIntent.category': 1 });

export const Query = mongoose.model('Query', querySchema);

/**
 * User Schema - Store user preferences and history
 */
const userSchema = new mongoose.Schema({
  instagramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  preferences: {
    favoriteCategories: [String],
    defaultLocation: String,
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalQueries: {
      type: Number,
      default: 0
    },
    lastActive: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const User = mongoose.model('User', userSchema);

/**
 * Event Cache Schema - Cache event data to reduce API calls
 */
const eventCacheSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  source: String,
  title: String,
  description: String,
  category: String,
  date: Date,
  time: String,
  venue: String,
  address: String,
  city: String,
  state: String,
  ticketLink: String,
  imageUrl: String,
  cachedAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours
  }
}, {
  timestamps: true
});

eventCacheSchema.index({ city: 1, category: 1, date: 1 });

export const EventCache = mongoose.model('EventCache', eventCacheSchema);

