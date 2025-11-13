"""
Re-run Google Places API search for restaurants with null Place IDs.

Uses improved search strategy:
1. Removes restrictive 'restaurant' type filter
2. Includes address in search query for better precision
3. Accepts cafes, bakeries, and other food establishments
"""

import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

# Configuration
DATABASE_NAME = 'nyc-events'
COLLECTION_NAME = 'restaurants'
WORKERS = 8  # Parallel workers for API calls
MIN_REQUEST_INTERVAL = 0.125  # 125ms between requests (~8 per second)

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), 'server', 'services', '.env')
load_dotenv(env_path if os.path.exists(env_path) else None)

# Load API Key
API_KEY = os.getenv('GOOGLE_PLACES_API_KEY_1') or os.getenv('GOOGLE_PLACES_API_KEY')

if not API_KEY:
    print("❌ Error: No API key found. Set GOOGLE_PLACES_API_KEY in .env")
    sys.exit(1)

# Global state for rate limiting
request_count = 0
request_lock = threading.Lock()
last_request_time = 0
stats_lock = threading.Lock()

# Statistics
stats = {
    'total': 0,
    'found': 0,
    'not_found': 0,
    'errors': 0,
    'updated': 0
}


def connect_to_mongodb():
    """Connect to MongoDB"""
    mongo_uri = os.getenv('MONGODB_URI') or os.getenv('MONGO_URI')
    
    if not mongo_uri:
        print("❌ MongoDB URI not found in environment variables")
        print("   Set MONGODB_URI or MONGO_URI in server/services/.env")
        return None
    
    try:
        client = MongoClient(mongo_uri)
        client.admin.command('ping')
        print("✅ Connected to MongoDB")
        return client
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None


def fetch_restaurant_details_improved(name, address):
    """Fetch restaurant details with improved search strategy"""
    # Build search query with address for better precision
    search_query = f"{name} New York"
    
    # Try to include street address in query
    if address:
        # Extract street part (before first comma)
        street_part = address.split(',')[0].strip()
        # Extract borough
        borough = None
        for b in ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']:
            if b in address:
                borough = b
                break
        
        if street_part and street_part != address:
            # Include street address for better precision
            search_query = f"{name} {street_part}"
            if borough:
                search_query += f" {borough} New York"
            else:
                search_query += " New York"
        elif borough:
            search_query = f"{name} {borough} New York"
    
    # Search with improved strategy - NO type filter initially
    # This allows finding cafes, bakeries, food stands, etc.
    search_url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.currentOpeningHours,places.googleMapsUri,places.types,places.editorialSummary'
    }
    
    try:
        # Rate limiting
        with request_lock:
            global last_request_time, request_count
            current_time = time.time()
            time_since_last = current_time - last_request_time
            if time_since_last < MIN_REQUEST_INTERVAL:
                time.sleep(MIN_REQUEST_INTERVAL - time_since_last)
            last_request_time = time.time()
            request_count += 1
        
        # Strategy 1: Search without type filter (broader search)
        # This will find restaurants, cafes, bakeries, food establishments, etc.
        payload = {
            'textQuery': search_query,
            'maxResultCount': 3  # Get multiple results to find best match
        }
        
        response = requests.post(search_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        
        places = response.json().get('places', [])
        if not places:
            return None
        
        # Filter results to find food-related establishments
        # Accept restaurants, cafes, bakeries, food establishments, etc.
        food_types = [
            'restaurant', 'cafe', 'bakery', 'food', 'establishment', 
            'meal_takeaway', 'meal_delivery', 'bar', 'night_club',
            'meal_restaurant'  # Google's meal restaurant type
        ]
        
        # Find best match - prefer places that are food-related
        best_match = None
        for place in places:
            place_types = place.get('types', [])
            # Check if any of the types match food-related categories
            if any(ft in str(place_types).lower() for ft in food_types):
                best_match = place
                break
        
        # If no food-related match found, use first result (might still be relevant)
        if not best_match and places:
            best_match = places[0]
        
        if not best_match:
            return None
        
        place = best_match
        
        # Extract data
        location = place.get('location', {})
        
        # Try editorialSummary for review text
        review_summary = None
        editorial = place.get('editorialSummary')
        if isinstance(editorial, dict):
            review_summary = editorial.get('text')
        
        # Convert price level to words
        price_levels = {
            0: 'Free', 1: 'Inexpensive', 2: 'Moderate', 3: 'Expensive', 4: 'Very Expensive',
            'PRICE_LEVEL_FREE': 'Free', 'PRICE_LEVEL_INEXPENSIVE': 'Inexpensive',
            'PRICE_LEVEL_MODERATE': 'Moderate', 'PRICE_LEVEL_EXPENSIVE': 'Expensive',
            'PRICE_LEVEL_VERY_EXPENSIVE': 'Very Expensive'
        }
        price_level = price_levels.get(place.get('priceLevel'))
        
        display_name = place.get('displayName')
        if isinstance(display_name, dict):
            display_name = display_name.get('text')
        
        opening_hours = place.get('currentOpeningHours', {})
        
        return {
            'rating': place.get('rating'),
            'price_level': price_level,
            'user_ratings_total': place.get('userRatingCount'),
            'matched_name': display_name,
            'matched_address': place.get('formattedAddress'),
            'latitude': location.get('latitude'),
            'longitude': location.get('longitude'),
            'phone_number': place.get('nationalPhoneNumber'),
            'website': place.get('websiteUri'),
            'business_status': place.get('businessStatus'),
            'google_maps_uri': place.get('googleMapsUri'),
            'types': place.get('types', []),
            'opening_hours': opening_hours.get('weekdayDescriptions', []),
            'review_summary': review_summary,
            'place_id': place.get('id')
        }
    except Exception as e:
        print(f"    Error in fetch_restaurant_details_improved: {str(e)}")
        return None


def process_restaurant(restaurant, collection):
    """Process a single restaurant and update MongoDB"""
    name = restaurant.get('Name', '')
    address = restaurant.get('fullAddress', '') or restaurant.get('address', '')
    restaurant_id = restaurant.get('_id')
    
    try:
        details = fetch_restaurant_details_improved(name, address)
        
        if details and details.get('place_id'):
            # Found a place ID - update the restaurant document
            update_data = {
                'rating': details.get('rating'),
                'priceLevel': details.get('price_level'),
                'userRatingsTotal': details.get('user_ratings_total'),
                'matchedName': details.get('matched_name'),
                'matchedAddress': details.get('matched_address'),
                'googleLatitude': details.get('latitude'),
                'googleLongitude': details.get('longitude'),
                'phoneNumber': details.get('phone_number'),
                'website': details.get('website'),
                'businessStatus': details.get('business_status'),
                'googleMapsUri': details.get('google_maps_uri'),
                'googleTypes': details.get('types'),
                'openingHours': details.get('opening_hours'),
                'reviewSummary': details.get('review_summary'),
                'googlePlaceId': details.get('place_id'),
                'lastUpdated': datetime.utcnow()
            }
            
            # Update in MongoDB
            collection.update_one(
                {'_id': restaurant_id},
                {'$set': update_data}
            )
            
            with stats_lock:
                stats['found'] += 1
                stats['updated'] += 1
            
            return {
                'success': True,
                'name': name,
                'place_id': details.get('place_id'),
                'matched_name': details.get('matched_name')
            }
        else:
            # Not found - keep as null but mark that we tried
            with stats_lock:
                stats['not_found'] += 1
            
            # Optionally update lastUpdated to track when we last tried
            collection.update_one(
                {'_id': restaurant_id},
                {'$set': {'lastUpdated': datetime.utcnow()}}
            )
            
            return {
                'success': False,
                'name': name,
                'place_id': None,
                'reason': 'Not found'
            }
    except Exception as e:
        with stats_lock:
            stats['errors'] += 1
        print(f"    Error processing {name}: {str(e)}")
        return {
            'success': False,
            'name': name,
            'place_id': None,
            'reason': f'Error: {str(e)}'
        }


def main():
    print("=" * 80)
    print("Re-fetching Google Place IDs for restaurants with null Place IDs")
    print("=" * 80)
    
    # Connect to MongoDB
    client = connect_to_mongodb()
    if not client:
        return
    
    try:
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]
        
        # Get restaurants with null place IDs
        print("\n📊 Finding restaurants with null Place IDs...")
        restaurants_with_null = list(collection.find({"googlePlaceId": None}))
        total = len(restaurants_with_null)
        stats['total'] = total
        
        if total == 0:
            print("✅ No restaurants with null Place IDs found!")
            return
        
        print(f"   Found {total} restaurants with null Place IDs")
        print(f"   Using {WORKERS} parallel workers")
        print(f"   Rate limit: {1/MIN_REQUEST_INTERVAL:.1f} requests/second")
        print(f"\n🚀 Starting search...\n")
        
        # Process in parallel
        start_time = time.time()
        completed = 0
        
        with ThreadPoolExecutor(max_workers=WORKERS) as executor:
            # Submit all tasks
            future_to_restaurant = {
                executor.submit(process_restaurant, r, collection): r 
                for r in restaurants_with_null
            }
            
            # Process completed tasks
            for future in as_completed(future_to_restaurant):
                completed += 1
                result = future.result()
                
                # Print progress
                status = "✅" if result['success'] else "❌"
                if result['success']:
                    print(f"[{completed}/{total}] {status} {result['name']} -> {result['matched_name']}")
                else:
                    print(f"[{completed}/{total}] {status} {result['name']} - {result['reason']}")
                
                # Print stats every 100 restaurants
                if completed % 100 == 0:
                    elapsed = time.time() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    remaining = (total - completed) / rate if rate > 0 else 0
                    with stats_lock:
                        print(f"\n📊 Progress: {completed}/{total} ({completed/total*100:.1f}%)")
                        print(f"   Found: {stats['found']} | Not found: {stats['not_found']} | Errors: {stats['errors']}")
                        print(f"   Rate: {rate:.1f} restaurants/sec | ETA: {remaining/60:.1f} minutes\n")
        
        # Final statistics
        elapsed = time.time() - start_time
        print(f"\n{'=' * 80}")
        print("📊 Final Statistics")
        print(f"{'=' * 80}")
        print(f"   Total processed: {stats['total']}")
        print(f"   ✅ Found Place IDs: {stats['found']} ({stats['found']/stats['total']*100:.1f}%)")
        print(f"   ❌ Not found: {stats['not_found']} ({stats['not_found']/stats['total']*100:.1f}%)")
        print(f"   ⚠️  Errors: {stats['errors']}")
        print(f"   📝 Updated in MongoDB: {stats['updated']}")
        print(f"   ⏱️  Time taken: {elapsed/60:.1f} minutes")
        print(f"   📈 Average rate: {stats['total']/elapsed:.2f} restaurants/second")
        print(f"   🔌 API requests made: {request_count}")
        
        # Verify results
        print(f"\n🔍 Verifying results in MongoDB...")
        still_null = collection.count_documents({"googlePlaceId": None})
        now_with_place_id = collection.count_documents({"googlePlaceId": {"$ne": None}})
        total_in_db = collection.count_documents({})
        
        print(f"   Total restaurants in DB: {total_in_db}")
        print(f"   With Place ID: {now_with_place_id} ({now_with_place_id/total_in_db*100:.1f}%)")
        print(f"   Still null: {still_null} ({still_null/total_in_db*100:.1f}%)")
        print(f"   Improvement: {stats['found']} new Place IDs found!")
        
        print(f"\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == '__main__':
    main()

