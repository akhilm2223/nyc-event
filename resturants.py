import pandas as pd
import json
import math
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, "DOHMH_New_York_City_Restaurant_Inspection_Results.csv")

df_csv = pd.read_csv(csv_path)
print(f"Original CSV shape: {df_csv.shape}")
print("Columns:")
print(df_csv.columns.tolist())
print("\nFirst 5 restaurants with addresses:")

# Extract unique restaurants and their addresses
unique_restaurants = df_csv.drop_duplicates(subset=['CAMIS'])
total_before_filtering = len(unique_restaurants)
print(f"Unique restaurants before filtering: {total_before_filtering}")

# Remove rows that don't have essential address information or name
unique_restaurants = unique_restaurants.dropna(subset=['DBA', 'BUILDING', 'STREET', 'BORO', 'CUISINE DESCRIPTION', 'Latitude', 'Longitude'])
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

# Save to JSON
def save_restaurants_to_json(unique_restaurants):
    """Save restaurant data to JSON file"""
    restaurants_data = []
    
    for idx, row in unique_restaurants.iterrows():
        try:
            restaurant_doc = {
                'Name': str(row['DBA']).strip() if pd.notna(row['DBA']) else '',
                'fullAddress': str(row['FULL_ADDRESS']).strip() if row['FULL_ADDRESS'] else '',
                'cuisineDescription': str(row['CUISINE DESCRIPTION']).strip() if pd.notna(row['CUISINE DESCRIPTION']) else '',
            }
            restaurants_data.append(restaurant_doc)
        except Exception as e:
            print(f"⚠️  Error processing row {idx}: {e}")
            continue
    
    if restaurants_data:
        try:
            print(f"\n💾 Saving {len(restaurants_data)} restaurants to restaurant_docs.json...")
            
            # Clean data for JSON serialization
            json_data = []
            for doc in restaurants_data:
                clean_doc = {}
                for key, value in doc.items():
                    if value is None:
                        clean_doc[key] = None
                    elif isinstance(value, float) and math.isnan(value):
                        clean_doc[key] = None
                    else:
                        clean_doc[key] = value
                json_data.append(clean_doc)
            
            # Write as newline-delimited JSON
            with open('restaurant_docs.json', 'w', encoding='utf-8') as f:
                for doc in json_data:
                    json.dump(doc, f, ensure_ascii=False)
                    f.write('\n')
            
            print(f"✅ Saved {len(json_data)} restaurants to restaurant_docs.json")
        except Exception as e:
            print(f"❌ Error saving to JSON file: {e}")
    else:
        print("⚠️  No restaurant data to save")

# Save data
print("\n" + "="*60)
print("SAVING TO JSON")
print("="*60)
save_restaurants_to_json(unique_restaurants)
