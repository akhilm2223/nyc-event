/**
 * Query Cache Service
 * Caches query results to avoid redundant API calls for duplicate queries
 * Now includes similarity detection to reuse cached results for similar queries
 * Uses Redis for persistence and multi-instance support
 */

import { log } from './cacheLogger.js';
import { createClient } from 'redis';

// Redis client - required for cache operations
let redisClient = null;
let redisInitialized = false;

// Default TTL: 1 hour (in milliseconds)
export const DEFAULT_TTL = 60 * 60 * 1000;

// Similarity threshold (0.0 to 1.0) - queries with similarity >= this will reuse cache
// 0.7 means 70% similar queries will reuse cached results
const SIMILARITY_THRESHOLD = 0.7;

// Debug mode - set to true to enable detailed logging
let DEBUG_MODE = true; // Enabled by default for debugging

// Redis key prefix
const REDIS_KEY_PREFIX = 'query_cache:';
const REDIS_META_PREFIX = 'query_meta:';

/**
 * Initialize Redis client - required for cache operations
 */
async function initializeCache() {
  const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST 
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
    : null);

  if (!redisUrl && !process.env.REDIS_URL) {
    const error = new Error('Redis is required but not configured. Please set REDIS_URL or REDIS_HOST environment variable.');
    console.error('❌ [REDIS]', error.message);
    log(`❌ [REDIS] ${error.message}`);
    throw error;
  }

  try {
    redisClient = createClient({
      url: redisUrl || process.env.REDIS_URL
    });

    redisClient.on('error', (err) => {
      console.error('❌ [REDIS] Redis Client Error:', err);
      log(`❌ [REDIS] Redis connection error: ${err.message}`);
      redisInitialized = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ [REDIS] Redis Client Connected');
      log('✅ [CACHE] Redis connected - cache will persist and be shared across instances');
    });

    await redisClient.connect();
    redisInitialized = true;
    console.log('✅ [REDIS] Redis initialized successfully');
    log('✅ [CACHE] Using Redis for cache storage - cache will persist and be shared across instances');
  } catch (error) {
    console.error('❌ [REDIS] Failed to connect to Redis:', error.message);
    log(`❌ [REDIS] Failed to connect to Redis: ${error.message}`);
    redisInitialized = false;
    throw error;
  }
}

/**
 * Ensure Redis is initialized
 */
async function ensureRedisInitialized() {
  if (!redisInitialized || !redisClient) {
    try {
      await initializeCache();
    } catch (error) {
      throw new Error(`Redis is not available: ${error.message}. Please ensure Redis is running and configured.`);
    }
  }
  if (!redisClient) {
    throw new Error('Redis client is not available. Please ensure Redis is running and configured.');
  }
}

// Initialize cache on module load (non-blocking)
initializeCache().catch(err => {
  console.error('❌ [REDIS] Failed to initialize cache:', err.message);
  console.error('⚠️  [REDIS] Server will start but cache operations will fail until Redis is available');
  log(`❌ [REDIS] Failed to initialize cache: ${err.message}`);
  log(`⚠️  [REDIS] Cache operations will fail until Redis is configured and running`);
  // Don't throw here - allow server to start, cache operations will handle errors
});

// Log startup message
console.log('🔧 [QUERY CACHE] Debug mode ENABLED - detailed cache operations will be logged to terminal\n');

/**
 * Normalize a query string for caching
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove extra spaces
 * - Remove punctuation that doesn't affect meaning
 * @param {string} query - The query string
 * @returns {string} - Normalized query
 */
function normalizeQuery(query) {
  if (!query) return '';
  
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[.,!?;:]/g, ''); // Remove punctuation
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Extract time-related keywords from a query
 * @param {string} query - The query string
 * @returns {Set<string>} - Set of time-related keywords found
 */
function extractTimeKeywords(query) {
  const timeKeywords = [
    'today', 'tomorrow', 'yesterday',
    'this week', 'next week', 'last week',
    'this month', 'next month', 'last month',
    'this weekend', 'next weekend',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'weekend', 'weekday',
    'morning', 'afternoon', 'evening', 'night',
    'now', 'soon', 'upcoming', 'coming'
  ];
  
  const lowerQuery = query.toLowerCase();
  const found = new Set();
  
  for (const keyword of timeKeywords) {
    if (lowerQuery.includes(keyword)) {
      found.add(keyword);
    }
  }
  
  return found;
}

/**
 * Calculate similarity score between two strings (0.0 to 1.0)
 * Uses a combination of Levenshtein distance and Jaccard similarity
 * Also considers time context - queries with different time constraints are less similar
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {boolean} debug - Enable debug logging
 * @returns {number} - Similarity score (0.0 = completely different, 1.0 = identical)
 */
function calculateSimilarity(str1, str2, debug = false) {
  if (!str1 || !str2) {
    if (debug) log(`   🔍 [SIMILARITY] Empty string detected: str1="${str1}", str2="${str2}"`);
    return 0;
  }
  if (str1 === str2) {
    if (debug) log(`   🔍 [SIMILARITY] Exact match (identical strings): "${str1}"`);
    return 1.0;
  }
  
  const normalized1 = normalizeQuery(str1);
  const normalized2 = normalizeQuery(str2);
  
  if (normalized1 === normalized2) {
    if (debug) log(`   🔍 [SIMILARITY] Exact match (after normalization): "${normalized1}"`);
    return 1.0;
  }
  
  if (debug) {
    log(`   🔍 [SIMILARITY] Comparing queries:`);
    log(`      Original 1: "${str1}"`);
    log(`      Original 2: "${str2}"`);
    log(`      Normalized 1: "${normalized1}"`);
    log(`      Normalized 2: "${normalized2}"`);
  }
  
  // Calculate Levenshtein similarity
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const distance = levenshteinDistance(normalized1, normalized2);
  const levenshteinSimilarity = 1 - (distance / maxLen);
  
  if (debug) {
    log(`   📏 [LEVENSHTEIN] Distance: ${distance}, Max length: ${maxLen}, Similarity: ${(levenshteinSimilarity * 100).toFixed(1)}%`);
  }
  
  // Calculate Jaccard similarity (word overlap)
  const words1 = new Set(normalized1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalized2.split(/\s+/).filter(w => w.length > 2));
  
  if (debug) {
    log(`   📝 [WORDS] Query 1 words: [${Array.from(words1).join(', ')}]`);
    log(`   📝 [WORDS] Query 2 words: [${Array.from(words2).join(', ')}]`);
  }
  
  if (words1.size === 0 && words2.size === 0) {
    if (debug) log(`   🔍 [SIMILARITY] No words to compare, using Levenshtein only: ${(levenshteinSimilarity * 100).toFixed(1)}%`);
    return levenshteinSimilarity;
  }
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;
  
  if (debug) {
    log(`   🔗 [JACCARD] Common words: [${Array.from(intersection).join(', ')}]`);
    log(`   🔗 [JACCARD] Intersection: ${intersection.size}, Union: ${union.size}, Similarity: ${(jaccardSimilarity * 100).toFixed(1)}%`);
  }
  
  // Combine both similarities (weighted average: 40% Levenshtein, 60% Jaccard)
  let combinedSimilarity = (levenshteinSimilarity * 0.4) + (jaccardSimilarity * 0.6);
  
  // Check for time context differences - reduce similarity if time constraints differ
  const timeKeywords1 = extractTimeKeywords(str1);
  const timeKeywords2 = extractTimeKeywords(str2);
  
  if (debug) {
    log(`   ⏰ [TIME CONTEXT] Query 1 time keywords: [${Array.from(timeKeywords1).join(', ') || 'none'}]`);
    log(`   ⏰ [TIME CONTEXT] Query 2 time keywords: [${Array.from(timeKeywords2).join(', ') || 'none'}]`);
  }
  
  // If one query has time keywords and the other doesn't, reduce similarity
  if (timeKeywords1.size > 0 && timeKeywords2.size === 0) {
    if (debug) log(`   ⚠️  [TIME CONTEXT] Query 1 has time context but Query 2 doesn't - reducing similarity`);
    combinedSimilarity *= 0.5; // Reduce by 50%
  } else if (timeKeywords1.size === 0 && timeKeywords2.size > 0) {
    if (debug) log(`   ⚠️  [TIME CONTEXT] Query 2 has time context but Query 1 doesn't - reducing similarity`);
    combinedSimilarity *= 0.5; // Reduce by 50%
  } else if (timeKeywords1.size > 0 && timeKeywords2.size > 0) {
    // Both have time keywords - check if they match
    const timeIntersection = new Set([...timeKeywords1].filter(x => timeKeywords2.has(x)));
    const timeUnion = new Set([...timeKeywords1, ...timeKeywords2]);
    const timeSimilarity = timeUnion.size > 0 ? timeIntersection.size / timeUnion.size : 0;
    
    if (debug) {
      log(`   ⏰ [TIME CONTEXT] Time keyword overlap: ${timeIntersection.size}/${timeUnion.size} = ${(timeSimilarity * 100).toFixed(1)}%`);
    }
    
    // If time contexts are different, significantly reduce similarity
    if (timeSimilarity < 0.5) {
      if (debug) log(`   ⚠️  [TIME CONTEXT] Different time contexts detected - reducing similarity by 60%`);
      combinedSimilarity *= 0.4; // Reduce by 60% (multiply by 0.4)
    } else if (timeSimilarity < 1.0) {
      if (debug) log(`   ⚠️  [TIME CONTEXT] Partially different time contexts - reducing similarity by 30%`);
      combinedSimilarity *= 0.7; // Reduce by 30% (multiply by 0.7)
    }
  }
  
  if (debug) {
    log(`   ✅ [COMBINED] Final similarity: ${(combinedSimilarity * 100).toFixed(1)}% (after time context adjustment)`);
    log(`      Threshold: ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%`);
    log(`      Match: ${combinedSimilarity >= SIMILARITY_THRESHOLD ? '✅ YES' : '❌ NO'}`);
  }
  
  return combinedSimilarity;
}

/**
 * Generate a cache key from query and optional date
 * @param {string} query - The user query
 * @param {Date|null} targetDate - Optional target date
 * @returns {string} - Cache key
 */
export function generateCacheKey(query, targetDate = null) {
  const normalizedQuery = normalizeQuery(query);
  const dateKey = targetDate ? `_date:${targetDate.toISOString().split('T')[0]}` : '';
  return `query:${normalizedQuery}${dateKey}`;
}

/**
 * Get cache entry from Redis
 */
async function getCacheEntry(key) {
  await ensureRedisInitialized();
  
  try {
    const dataStr = await redisClient.get(REDIS_KEY_PREFIX + key);
    const metaStr = await redisClient.get(REDIS_META_PREFIX + key);
    
    if (!dataStr || !metaStr) return null;
    
    const data = JSON.parse(dataStr);
    const meta = JSON.parse(metaStr);
    
    return {
      data,
      expiresAt: meta.expiresAt,
      originalQuery: meta.originalQuery
    };
  } catch (error) {
    log(`❌ [REDIS] Error reading from Redis: ${error.message}`);
    throw error;
  }
}

/**
 * Set cache entry in Redis
 */
async function setCacheEntry(key, value, ttlMs) {
  await ensureRedisInitialized();
  
  try {
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await redisClient.setEx(REDIS_KEY_PREFIX + key, ttlSeconds, JSON.stringify(value.data));
    await redisClient.setEx(REDIS_META_PREFIX + key, ttlSeconds, JSON.stringify({
      expiresAt: value.expiresAt,
      originalQuery: value.originalQuery
    }));
  } catch (error) {
    log(`❌ [REDIS] Error writing to Redis: ${error.message}`);
    throw error;
  }
}

/**
 * Delete cache entry from Redis
 */
async function deleteCacheEntry(key) {
  await ensureRedisInitialized();
  
  try {
    await redisClient.del(REDIS_KEY_PREFIX + key);
    await redisClient.del(REDIS_META_PREFIX + key);
  } catch (error) {
    log(`❌ [REDIS] Error deleting from Redis: ${error.message}`);
    throw error;
  }
}

/**
 * Get all cache keys from Redis (for similarity search)
 */
async function getAllCacheKeys() {
  await ensureRedisInitialized();
  
  try {
    const keys = await redisClient.keys(REDIS_KEY_PREFIX + '*');
    return keys.map(key => key.replace(REDIS_KEY_PREFIX, ''));
  } catch (error) {
    log(`❌ [REDIS] Error getting keys from Redis: ${error.message}`);
    throw error;
  }
}

/**
 * Get cache size from Redis
 */
async function getCacheSize() {
  await ensureRedisInitialized();
  
  try {
    const keys = await redisClient.keys(REDIS_KEY_PREFIX + '*');
    return keys.length;
  } catch (error) {
    log(`❌ [REDIS] Error getting cache size from Redis: ${error.message}`);
    throw error;
  }
}

/**
 * Get cached result if available and not expired
 * Also checks for similar queries in cache
 * @param {string} cacheKey - The cache key
 * @param {string} originalQuery - The original query string (for similarity matching)
 * @param {boolean} debug - Enable debug logging
 * @returns {any|null} - Cached data or null if not found/expired
 */
export async function getCachedResult(cacheKey, originalQuery = null, debug = null) {
  // Use global debug mode if debug parameter is not explicitly set
  const useDebug = debug !== null ? debug : DEBUG_MODE;
  
  log(`\n🔍 [CACHE LOOKUP] Checking cache for query: "${originalQuery || cacheKey}"`);
  log(`   Cache key: ${cacheKey}`);
  log(`   Storage: Redis`);
  const cacheSize = await getCacheSize();
  log(`   Cache size: ${cacheSize} entries`);
  if (useDebug) {
    log(`   🔧 Debug mode: ENABLED`);
  }
  
  const cached = await getCacheEntry(cacheKey);
  
  // Check exact match first
  if (cached) {
    // Check if expired
    if (cached.expiresAt < Date.now()) {
      log(`   ⏰ [CACHE] Entry expired, removing from cache`);
      await deleteCacheEntry(cacheKey);
    } else {
      const timeRemaining = Math.round((cached.expiresAt - Date.now()) / 1000 / 60);
      log(`   ✅ [CACHE] Exact match found!`);
      log(`   💾 Cache HIT (exact match) for key: ${cacheKey}`);
      log(`   🌐 Shared cache - this result was cached by any user and is now being reused`);
      log(`   ⏰ Time remaining: ${timeRemaining} minutes`);
      return cached.data;
    }
  } else {
    log(`   ❌ [CACHE] No exact match found`);
  }
  
  // If no exact match and we have original query, check for similar queries
  if (originalQuery) {
    log(`\n🔍 [SIMILARITY SEARCH] Starting similarity search...`);
    log(`   Query: "${originalQuery}"`);
    log(`   Threshold: ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%`);
    const allKeys = await getAllCacheKeys();
    log(`   Checking ${allKeys.length} cached entries...`);
    
    const normalizedQuery = normalizeQuery(originalQuery);
    let bestMatch = null;
    let bestSimilarity = 0;
    let bestKey = null;
    let checkedCount = 0;
    let expiredCount = 0;
    let noQueryCount = 0;
    const similarityScores = [];
    
    const now = Date.now();
    for (const key of allKeys) {
      const value = await getCacheEntry(key);
      
      // Skip expired entries
      if (!value || value.expiresAt < now) {
        if (value) {
          expiredCount++;
          await deleteCacheEntry(key);
        }
        continue;
      }
      
      // Extract original query from cache entry
      const cachedQuery = value.originalQuery || '';
      if (!cachedQuery) {
        noQueryCount++;
        continue;
      }
      
      checkedCount++;
      
      // Extract dates from cache keys for comparison
      const currentDateMatch = cacheKey.match(/_date:(\d{4}-\d{2}-\d{2})/);
      const cachedDateMatch = key.match(/_date:(\d{4}-\d{2}-\d{2})/);
      const currentDate = currentDateMatch ? currentDateMatch[1] : null;
      const cachedDate = cachedDateMatch ? cachedDateMatch[1] : null;
      
      // Calculate similarity
      let similarity = calculateSimilarity(normalizedQuery, normalizeQuery(cachedQuery), useDebug);
      
      // If dates are different, significantly reduce similarity
      if (currentDate && cachedDate && currentDate !== cachedDate) {
        if (useDebug) {
          log(`   📅 [DATE COMPARISON] Current date: ${currentDate}, Cached date: ${cachedDate} - dates differ!`);
        }
        // Reduce similarity by 70% if dates are different
        similarity *= 0.3;
        if (useDebug) {
          log(`   ⚠️  [DATE COMPARISON] Different dates detected - reducing similarity by 70%`);
          log(`   📊 [CHECK ${checkedCount}] "${cachedQuery}" → ${(similarity * 100).toFixed(1)}% (after date penalty)`);
        }
      } else if ((currentDate && !cachedDate) || (!currentDate && cachedDate)) {
        // One has a date and the other doesn't - reduce similarity
        if (useDebug) {
          log(`   ⚠️  [DATE COMPARISON] One query has date context, other doesn't - reducing similarity by 50%`);
        }
        similarity *= 0.5;
      } else if (useDebug) {
        log(`   📊 [CHECK ${checkedCount}] "${cachedQuery}" → ${(similarity * 100).toFixed(1)}%`);
      }
      
      similarityScores.push({
        key,
        query: cachedQuery,
        similarity: similarity * 100
      });
      
      if (similarity >= SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = value.data;
        bestKey = key;
        if (useDebug) {
          log(`      ⭐ New best match!`);
        }
      }
    }
    
    log(`\n📊 [SIMILARITY SEARCH RESULTS]`);
    log(`   Total entries checked: ${checkedCount}`);
    log(`   Expired entries skipped: ${expiredCount}`);
    log(`   Entries without query: ${noQueryCount}`);
    
    if (similarityScores.length > 0) {
      // Sort by similarity descending
      similarityScores.sort((a, b) => b.similarity - a.similarity);
      log(`\n   Top similarity scores:`);
      similarityScores.slice(0, 5).forEach((item, index) => {
        const match = item.similarity >= SIMILARITY_THRESHOLD * 100 ? '✅' : '❌';
        log(`   ${index + 1}. ${match} ${item.similarity.toFixed(1)}% - "${item.query}"`);
      });
    }
    
    if (bestMatch) {
      const similarityPercent = Math.round(bestSimilarity * 100);
      const bestValue = await getCacheEntry(bestKey);
      const matchedQuery = bestValue?.originalQuery || 'unknown';
      log(`\n   ✅ [CACHE HIT] Similar query found!`);
      log(`   💾 Cache HIT (similarity: ${similarityPercent}%) for query: "${originalQuery}"`);
      log(`   🌐 Shared cache - this result was cached by any user and is now being reused`);
      log(`   → Matched cached query: "${matchedQuery}"`);
      log(`   → Cache key: ${bestKey}`);
      return bestMatch;
    } else {
      log(`\n   ❌ [CACHE MISS] No similar queries found above threshold`);
      log(`   💾 Cache MISS - will fetch fresh data`);
    }
  } else {
    log(`   ⚠️  [CACHE] No original query provided, skipping similarity search`);
  }
  
  return null;
}

/**
 * Store result in cache
 * @param {string} cacheKey - The cache key
 * @param {any} data - The data to cache
 * @param {number} ttl - Time to live in milliseconds (default: 1 hour)
 * @param {string} originalQuery - The original query string (for similarity matching)
 * @param {boolean} debug - Enable debug logging
 */
export async function setCachedResult(cacheKey, data, ttl = DEFAULT_TTL, originalQuery = null, debug = null) {
  // Use global debug mode if debug parameter is not explicitly set
  const useDebug = debug !== null ? debug : DEBUG_MODE;
  
  const expiresAt = Date.now() + ttl;
  const ttlMinutes = Math.round(ttl / 1000 / 60);
  
  if (useDebug) {
    log(`\n💾 [CACHE SET] Storing result in cache...`);
    log(`   Cache key: ${cacheKey}`);
    log(`   Original query: "${originalQuery || cacheKey}"`);
    log(`   TTL: ${ttlMinutes} minutes`);
    log(`   Expires at: ${new Date(expiresAt).toISOString()}`);
    log(`   Storage: Redis`);
    const cacheSize = await getCacheSize();
    log(`   Cache size before: ${cacheSize}`);
  }
  
  const cacheValue = {
    data,
    expiresAt,
    originalQuery: originalQuery || cacheKey // Store original query for similarity matching
  };
  
  await setCacheEntry(cacheKey, cacheValue, ttl);
  
  log(`💾 Cache SET for key: ${cacheKey} (expires in ${ttlMinutes} minutes)`);
  log(`   🌐 Shared cache - this result will be available to all users`);
  if (useDebug) {
    const cacheSize = await getCacheSize();
    log(`   Cache size after: ${cacheSize}`);
    log(`   ✅ Cache entry stored successfully`);
  }
}

/**
 * Clear a specific cache entry
 * @param {string} cacheKey - The cache key to clear
 */
export async function clearCache(cacheKey) {
  await deleteCacheEntry(cacheKey);
  log(`💾 Cache CLEARED for key: ${cacheKey}`);
}

/**
 * Clear all cache entries
 */
export async function clearAllCache() {
  await ensureRedisInitialized();
  
  try {
    const keys = await redisClient.keys(REDIS_KEY_PREFIX + '*');
    const metaKeys = await redisClient.keys(REDIS_META_PREFIX + '*');
    if (keys.length > 0) await redisClient.del(keys);
    if (metaKeys.length > 0) await redisClient.del(metaKeys);
    log(`💾 Cache CLEARED: ${keys.length} entries removed from Redis`);
  } catch (error) {
    log(`❌ [REDIS] Error clearing Redis cache: ${error.message}`);
    throw error;
  }
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats
 */
export async function getCacheStats() {
  const now = Date.now();
  let expiredCount = 0;
  let activeCount = 0;
  
  const allKeys = await getAllCacheKeys();
  for (const key of allKeys) {
    const value = await getCacheEntry(key);
    if (value) {
      if (value.expiresAt < now) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }
  }
  
  return {
    total: allKeys.length,
    active: activeCount,
    expired: expiredCount,
    similarityThreshold: SIMILARITY_THRESHOLD,
    storage: 'Redis'
  };
}

/**
 * Get the similarity threshold
 * @returns {number} - Current similarity threshold (0.0 to 1.0)
 */
export function getSimilarityThreshold() {
  return SIMILARITY_THRESHOLD;
}

/**
 * Enable or disable debug mode
 * @param {boolean} enabled - Whether to enable debug mode
 */
export function setDebugMode(enabled) {
  DEBUG_MODE = enabled;
  log(`🔧 [CACHE DEBUG] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Get current debug mode status
 * @returns {boolean} - Whether debug mode is enabled
 */
export function getDebugMode() {
  return DEBUG_MODE;
}

/**
 * Get detailed cache information for debugging
 * @returns {Object} - Detailed cache information
 */
export async function getCacheDebugInfo() {
  const now = Date.now();
  const entries = [];
  
  const allKeys = await getAllCacheKeys();
  for (const key of allKeys) {
    const value = await getCacheEntry(key);
    if (value) {
      const isExpired = value.expiresAt < now;
      const timeRemaining = isExpired ? 0 : Math.round((value.expiresAt - now) / 1000 / 60);
      
      entries.push({
        key,
        originalQuery: value.originalQuery || 'N/A',
        isExpired,
        timeRemaining: isExpired ? 'Expired' : `${timeRemaining} minutes`,
        expiresAt: new Date(value.expiresAt).toISOString(),
        hasData: !!value.data
      });
    }
  }
  
  return {
    totalEntries: allKeys.length,
    activeEntries: entries.filter(e => !e.isExpired).length,
    expiredEntries: entries.filter(e => e.isExpired).length,
    similarityThreshold: SIMILARITY_THRESHOLD,
    debugMode: DEBUG_MODE,
    storage: 'Redis',
    entries: entries.sort((a, b) => {
      // Sort: active first, then by expiration time
      if (a.isExpired !== b.isExpired) {
        return a.isExpired ? 1 : -1;
      }
      return b.expiresAt.localeCompare(a.expiresAt);
    })
  };
}

// Export logger functions for external use
export { setFileLogging, setConsoleLogging, getLoggingConfig, clearLogFile } from './cacheLogger.js';
