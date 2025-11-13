import Restaurant from '../models/Restaurant.js';

/**
 * Search restaurants by cuisine, name, or other criteria
 */
export async function searchRestaurants(query) {
  try {
    const {
      cuisine,
      name,
      priceLevel,
      minRating,
      limit = 10,
      page = 1
    } = query;

    const filter = {};

    // Flexible search on name and cuisine using regex (case-insensitive)
    if (name || cuisine) {
      const orConditions = [];
      
      if (name) {
        orConditions.push({ Name: { $regex: name, $options: 'i' } });
        orConditions.push({ matchedName: { $regex: name, $options: 'i' } });
      }
      
      if (cuisine) {
        orConditions.push({ cuisineDescription: { $regex: cuisine, $options: 'i' } });
      }
      
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }
    }

    // Filter by price level
    if (priceLevel) {
      filter.priceLevel = priceLevel;
    }

    // Filter by minimum rating
    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    // Only return restaurants with valid data (has Google Place ID)
    filter.googlePlaceId = { $ne: null };

    // Get total count
    const totalCount = await Restaurant.countDocuments(filter);

    // Get paginated results
    const skip = (page - 1) * limit;
    const restaurants = await Restaurant
      .find(filter)
      .sort({ rating: -1, userRatingsTotal: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      totalCount,
      results: restaurants,
      page,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: skip + restaurants.length < totalCount
    };
  } catch (error) {
    console.error('Error searching restaurants:', error);
    throw error;
  }
}

/**
 * Get restaurant by ID
 */
export async function getRestaurantById(id) {
  try {
    return await Restaurant.findById(id).lean();
  } catch (error) {
    console.error('Error getting restaurant:', error);
    throw error;
  }
}

/**
 * Get restaurant statistics
 */
export async function getRestaurantStats() {
  try {
    const total = await Restaurant.countDocuments({});
    const withPlaceId = await Restaurant.countDocuments({ googlePlaceId: { $ne: null } });
    const withRatings = await Restaurant.countDocuments({ rating: { $ne: null } });
    
    return {
      total,
      withPlaceId,
      withRatings,
      coverage: ((withPlaceId / total) * 100).toFixed(1) + '%'
    };
  } catch (error) {
    console.error('Error getting restaurant stats:', error);
    throw error;
  }
}
