import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema({
  Name: {
    type: String,
    required: true,
    index: true
  },
  fullAddress: String,
  cuisineDescription: {
    type: String,
    index: true
  },
  rating: Number,
  priceLevel: String,
  userRatingsTotal: Number,
  matchedName: String,
  matchedAddress: String,
  googleLatitude: Number,
  googleLongitude: Number,
  phoneNumber: String,
  website: String,
  businessStatus: String,
  googleMapsUri: String,
  googleTypes: [String],
  openingHours: [String],
  reviewSummary: String,
  googlePlaceId: {
    type: String,
    index: true,
    sparse: true
  },
  lastUpdated: Date
}, {
  timestamps: true,
  collection: 'restaurants'
});

// Indexes for common queries
restaurantSchema.index({ Name: 'text', cuisineDescription: 'text' });
restaurantSchema.index({ rating: -1 });
restaurantSchema.index({ priceLevel: 1 });

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

export default Restaurant;
