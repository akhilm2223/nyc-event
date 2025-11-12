"""
Import restaurant documents with reviews into MongoDB.

Usage:
    python import_restaurants_to_mongo.py
"""

import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), 'server', 'services', '.env')
load_dotenv(env_path if os.path.exists(env_path) else None)

# Configuration
INPUT_FILE = 'restaurant_docs_with_reviews.json'
DATABASE_NAME = 'nyc-events'
COLLECTION_NAME = 'restaurants'

def connect_to_mongodb():
    """Connect to MongoDB"""
    mongo_uri = os.getenv('MONGODB_URI') or os.getenv('MONGO_URI')
    
    if not mongo_uri:
        print("❌ MongoDB URI not found in environment variables")
        print("   Set MONGODB_URI or MONGO_URI in server/services/.env")
        return None
    
    try:
        client = MongoClient(mongo_uri)
        # Test connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB")
        return client
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None


def load_restaurants(filename):
    """Load restaurants from JSONL file"""
    restaurants = []
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    restaurants.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"⚠️  Skipped invalid JSON line: {e}")
    return restaurants


def main():
    print(f"📂 Loading restaurants from {INPUT_FILE}...")
    restaurants = load_restaurants(INPUT_FILE)
    print(f"   Loaded {len(restaurants)} restaurants")
    
    # Connect to MongoDB
    client = connect_to_mongodb()
    if not client:
        return
    
    try:
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]
        
        # Clear existing data (optional - comment out if you want to keep existing)
        print(f"\n🗑️  Clearing existing data in {COLLECTION_NAME}...")
        result = collection.delete_many({})
        print(f"   Deleted {result.deleted_count} existing documents")
        
        # Insert restaurants
        print(f"\n📥 Inserting {len(restaurants)} restaurants...")
        if restaurants:
            result = collection.insert_many(restaurants, ordered=False)
            print(f"✅ Inserted {len(result.inserted_ids)} restaurants")
        
        # Create indexes for better query performance
        print(f"\n🔍 Creating indexes...")
        collection.create_index([("Name", 1)])
        collection.create_index([("cuisineDescription", 1)])
        collection.create_index([("rating", -1)])
        collection.create_index([("priceLevel", 1)])
        collection.create_index([("googlePlaceId", 1)], sparse=True)  # Not unique because many are null
        print("✅ Indexes created")
        
        # Show statistics
        print(f"\n📊 Statistics:")
        total = collection.count_documents({})
        with_reviews = collection.count_documents({"reviewSummary": {"$ne": None}})
        with_ratings = collection.count_documents({"rating": {"$ne": None}})
        with_price = collection.count_documents({"priceLevel": {"$ne": None}})
        
        print(f"   Total restaurants: {total}")
        print(f"   With reviews: {with_reviews} ({with_reviews/total*100:.1f}%)")
        print(f"   With ratings: {with_ratings} ({with_ratings/total*100:.1f}%)")
        print(f"   With price levels: {with_price} ({with_price/total*100:.1f}%)")
        
        print(f"\n✅ Done! All restaurants imported to MongoDB")
        print(f"   Database: {DATABASE_NAME}")
        print(f"   Collection: {COLLECTION_NAME}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        client.close()


if __name__ == '__main__':
    main()

