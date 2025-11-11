import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String },
  location: { type: String },
  description: { type: String },
  link: { type: String },
  price: { type: String },
  source: { type: String, required: true }, // GoodRec, The Skint, NYC for FREE, etc.
  platform: { type: String }, // Eventbrite, Luma, Meetup, etc.
  scrapedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true } // Mark as inactive after event date passes
}, {
  timestamps: true
});

// Index for faster searches
eventSchema.index({ date: 1, source: 1 });
eventSchema.index({ name: 'text', description: 'text' });

const Event = mongoose.model('Event', eventSchema);

export default Event;
