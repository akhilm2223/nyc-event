import pandas as pd
import json
import pymongo
from pymongo import MongoClient
import os
from dotenv import load_dotenv

df_csv = pd.read_csv("DOHMH_New_York_City_Restaurant_Inspection_Results.csv")
print(f"Original CSV shape: {df_csv.shape}")
print("Columns:")
print(df_csv.columns.tolist())
print("\nFirst 5 restaurants with addresses:")

# Extract unique restaurants and their addresses
unique_restaurants = df_csv.drop_duplicates(subset=['CAMIS'])
total_before_filtering = len(unique_restaurants)
print(f"Unique restaurants before filtering: {total_before_filtering}")

# Remove rows that don't have essential address information or name
unique_restaurants = unique_restaurants.dropna(subset=['DBA', 'BUILDING', 'STREET', 'BORO', 'CUISINE DESCRIPTION'])
total_after_address_filtering = len(unique_restaurants)
rows_removed_address = total_before_filtering - total_after_address_filtering
print(f"Unique restaurants after filtering out missing names or addresses: {total_after_address_filtering}")
print(f"Rows removed due to missing names or address information: {rows_removed_address}")

# Create full address by combining relevant columns
def create_full_address(row):
    building = str(row['BUILDING']).strip() if pd.notna(row['BUILDING']) else ''
    street = str(row['STREET']).strip() if pd.notna(row['STREET']) else ''
    boro = str(row['BORO']).strip() if pd.notna(row['BORO']) else ''
    zipcode = str(row['ZIPCODE']).strip() if pd.notna(row['ZIPCODE']) else ''

    address_parts = [building, street, boro, zipcode]
    address_parts = [part for part in address_parts if part and part.lower() != 'nan']
    return ', '.join(address_parts)

# Add full address column
unique_restaurants['FULL_ADDRESS'] = unique_restaurants.apply(create_full_address, axis=1)

#print cols
print(unique_restaurants.columns.tolist())

# Display first 20 restaurant names and addresses
print("Sample of restaurant addresses:")
for idx, row in unique_restaurants[['DBA', 'FULL_ADDRESS']].head(20).iterrows():
    restaurant_name = row['DBA'] if pd.notna(row['DBA']) else 'Unknown'
    address = row['FULL_ADDRESS'] if row['FULL_ADDRESS'] else 'No address available'
    print(f"{restaurant_name}: {address}")

print(f"\n... and {len(unique_restaurants) - 20} more restaurants")

# Connect to MongoDB
def connect_to_mongodb():
    """Connect to MongoDB using environment variables"""
    # Load from server/.env file
    env_path = os.path.join(os.path.dirname(__file__), 'server', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
    
    mongo_uri = os.getenv('MONGODB_URI') or os.getenv('MONGO_URI')

    if not mongo_uri:
        print("⚠️  MongoDB URI not found in environment variables or server/.env file")
        print("   Set MONGODB_URI or MONGO_URI environment variable")
        return None

    try:
        client = MongoClient(mongo_uri)
        # Test the connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully")
        return client
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None

def insert_restaurants_to_mongo(unique_restaurants, mongo_client):
    """Insert only name, address, and cuisine description into MongoDB"""
    if not mongo_client:
        return

    db = mongo_client.get_default_database()
    restaurants_collection = db.restaurants

    # Clear existing data
    print("🧹 Clearing existing restaurant data...")
    restaurants_collection.drop()

    # Prepare data for insertion - only 3 fields
    restaurants_data = []

    for idx, row in unique_restaurants.iterrows():
        try:
            # Create simplified restaurant document with only requested fields
            restaurant_doc = {
                'Name': str(row['DBA']).strip() if pd.notna(row['DBA']) else '',
                'fullAddress': str(row['FULL_ADDRESS']).strip() if row['FULL_ADDRESS'] else '',
                'cuisineDescription': str(row['CUISINE DESCRIPTION']).strip() if pd.notna(row['CUISINE DESCRIPTION']) else ''
            }

            #also put the doc in a json file
            with open('restaurant_docs.json', 'a') as f:
                json.dump(restaurant_doc, f)
                f.write('\n')

            restaurants_data.append(restaurant_doc)

        except Exception as e:
            print(f"⚠️  Error processing row {idx}: {e}")
            continue

    # Insert data in batches
    if restaurants_data:
        try:
            print(f"📥 Inserting {len(restaurants_data)} restaurants into MongoDB...")
            batch_size = 1000

            for i in range(0, len(restaurants_data), batch_size):
                batch = restaurants_data[i:i + batch_size]
                try:
                    result = restaurants_collection.insert_many(batch, ordered=False)
                    print(f"   ✅ Inserted batch {i//batch_size + 1}/{(len(restaurants_data) + batch_size - 1)//batch_size} ({len(batch)} restaurants)")
                except pymongo.errors.BulkWriteError as e:
                    # Handle duplicate key errors gracefully
                    successful_inserts = e.details['nInserted']
                    if successful_inserts > 0:
                        print(f"   ⚠️  Batch {i//batch_size + 1} partially inserted: {successful_inserts}/{len(batch)} (duplicates skipped)")
                    else:
                        print(f"   ❌ Batch {i//batch_size + 1} failed to insert")
                except Exception as e:
                    print(f"   ❌ Error inserting batch {i//batch_size + 1}: {e}")

            print(f"✅ Successfully processed {len(restaurants_data)} restaurants")

            # Create indexes for better performance
            print("🔧 Creating database indexes...")
            restaurants_collection.create_index([('Name', 1)])
            restaurants_collection.create_index([('cuisineDescription', 1)])
            print("✅ Indexes created")

        except Exception as e:
            print(f"❌ Error inserting data to MongoDB: {e}")
    else:
        print("⚠️  No restaurant data to insert")

# Insert data to MongoDB
print("\n" + "="*60)
print("INSERTING TO MONGODB")
print("="*60)
mongo_client = connect_to_mongodb()
if mongo_client:
    insert_restaurants_to_mongo(unique_restaurants, mongo_client)
    mongo_client.close()
    print("\n✅ Restaurant data has been inserted into MongoDB!")
    print("   Fields: Name, fullAddress, cuisineDescription")
else:
    print("\n⚠️  Skipped MongoDB insertion")
