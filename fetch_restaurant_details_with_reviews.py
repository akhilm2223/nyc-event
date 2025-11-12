"""
Fetch restaurant details with review summaries using Google Places API.
"""

import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from dotenv import load_dotenv

# Configuration
INPUT_FILE = 'restaurant_docs.json'
OUTPUT_FILE = 'restaurant_docs_with_reviews.json'
MAX_RESTAURANTS = 27000  # Process all restaurants
WORKERS = 10  # More workers for parallel processing

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), 'server', 'services', '.env')
load_dotenv(env_path if os.path.exists(env_path) else None)

# Load API Key
API_KEY = os.getenv('GOOGLE_PLACES_API_KEY_1') or os.getenv('GOOGLE_PLACES_API_KEY')

if not API_KEY:
    print("Error: No API key found. Set GOOGLE_PLACES_API_KEY in .env")
    sys.exit(1)

request_count = 0
request_lock = threading.Lock()
last_request_time = 0
MIN_REQUEST_INTERVAL = 0.125  # 125ms between requests (~8 per second, safe margin)


def fetch_restaurant_details(name, address):
    """Fetch restaurant details with review summary (1 API call)"""
    # Build search query
    search_query = f"{name} New York"
    for borough in ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']:
        if borough in address:
            search_query = f"{name} {borough} New York"
            break
    
    # Search with all fields in one request
    search_url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.currentOpeningHours,places.googleMapsUri,places.types,places.editorialSummary'
    }
    
    try:
        # Rate limiting: wait between requests
        with request_lock:
            global last_request_time, request_count
            current_time = time.time()
            time_since_last = current_time - last_request_time
            if time_since_last < MIN_REQUEST_INTERVAL:
                time.sleep(MIN_REQUEST_INTERVAL - time_since_last)
            last_request_time = time.time()
            request_count += 1
        
        response = requests.post(search_url, json={'textQuery': search_query, 'includedType': 'restaurant', 'maxResultCount': 1}, 
                                headers=headers, timeout=10)
        response.raise_for_status()
        
        places = response.json().get('places', [])
        if not places:
            return None
        
        place = places[0]
        
        # Extract data
        location = place.get('location', {})
        
        # Try editorialSummary for review text
        review_summary = None
        editorial = place.get('editorialSummary')
        if isinstance(editorial, dict):
            review_summary = editorial.get('text')
        
        # Convert price level to words
        price_levels = {0: 'Free', 1: 'Inexpensive', 2: 'Moderate', 3: 'Expensive', 4: 'Very Expensive',
                       'PRICE_LEVEL_FREE': 'Free', 'PRICE_LEVEL_INEXPENSIVE': 'Inexpensive',
                       'PRICE_LEVEL_MODERATE': 'Moderate', 'PRICE_LEVEL_EXPENSIVE': 'Expensive',
                       'PRICE_LEVEL_VERY_EXPENSIVE': 'Very Expensive'}
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
        print(f"    Error in fetch_restaurant_details: {str(e)}")
        return None


def process_restaurant(restaurant):
    """Process a single restaurant"""
    name = restaurant.get('Name', '')
    address = restaurant.get('fullAddress', '')
    
    try:
        details = fetch_restaurant_details(name, address)
        if details:
            restaurant['rating'] = details.get('rating')
            restaurant['priceLevel'] = details.get('price_level')
            restaurant['userRatingsTotal'] = details.get('user_ratings_total')
            restaurant['matchedName'] = details.get('matched_name')
            restaurant['matchedAddress'] = details.get('matched_address')
            restaurant['googleLatitude'] = details.get('latitude')
            restaurant['googleLongitude'] = details.get('longitude')
            restaurant['phoneNumber'] = details.get('phone_number')
            restaurant['website'] = details.get('website')
            restaurant['businessStatus'] = details.get('business_status')
            restaurant['googleMapsUri'] = details.get('google_maps_uri')
            restaurant['googleTypes'] = details.get('types')
            restaurant['openingHours'] = details.get('opening_hours')
            restaurant['reviewSummary'] = details.get('review_summary')
            restaurant['googlePlaceId'] = details.get('place_id')
        else:
            # Mark as not found but keep original data
            restaurant['rating'] = None
            restaurant['priceLevel'] = None
            restaurant['googlePlaceId'] = None
    except Exception as e:
        print(f"    Error processing {name}: {str(e)}")
        restaurant['rating'] = None
        restaurant['priceLevel'] = None
        restaurant['googlePlaceId'] = None
    
    return restaurant


def main():
    # Load restaurants
    print(f"Loading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        try:
            restaurants = json.loads(content)
            if not isinstance(restaurants, list):
                restaurants = [json.loads(line) for line in content.split('\n') if line.strip()]
        except:
            restaurants = [json.loads(line) for line in content.split('\n') if line.strip()]
    
    restaurants = restaurants[:MAX_RESTAURANTS]
    
    print(f"Processing {len(restaurants)} restaurants...")
    
    # Process in parallel
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        # Map futures to original index to preserve order
        future_to_index = {executor.submit(process_restaurant, r): i for i, r in enumerate(restaurants)}
        results = [None] * len(restaurants)
        completed = 0
        
        for future in as_completed(future_to_index):
            completed += 1
            index = future_to_index[future]
            result = future.result()
            results[index] = result
            
            name = result.get('Name', '')
            has_review = 'Yes' if result.get('reviewSummary') else 'No'
            print(f"[{completed}/{len(restaurants)}] {name} - Review: {has_review}")
    
    # Save results
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        for restaurant in results:
            json.dump(restaurant, f, ensure_ascii=False)
            f.write('\n')
    
    # Show usage
    print(f"\n✅ Done! Made {request_count} API requests")


if __name__ == '__main__':
    main()
