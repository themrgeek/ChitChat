const crypto = require('crypto');

class LRUCache {
  constructor(maxSize = 1000, defaultTTL = 3600000) { // 1 hour default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
    this.accessOrder = new Map(); // For LRU eviction
    this.accessCounter = 0;
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }

    // Update access order for LRU
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.accessOrder.set(key, ++this.accessCounter);

    return entry.data;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;

    // Remove existing entry if present
    this.delete(key);

    // Check if we need to evict
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry = {
      data: value,
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder.delete(key);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let totalAccess = 0;
    let avgTTL = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) expired++;
      totalAccess += entry.accessCount;
      avgTTL += (entry.expiresAt - entry.createdAt);
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredEntries: expired,
      totalAccessCount: totalAccess,
      averageAccessCount: this.cache.size > 0 ? totalAccess / this.cache.size : 0,
      averageTTL: this.cache.size > 0 ? avgTTL / this.cache.size : 0,
      hitRate: this.cache.size > 0 ? (totalAccess / (totalAccess + (this.maxSize - this.cache.size))) : 0
    };
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldestKey = null;
    let oldestAccess = Infinity;

    for (const [key, accessCount] of this.accessOrder) {
      if (accessCount < oldestAccess) {
        oldestAccess = accessCount;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Clean expired entries
   * @returns {number} Number of expired entries removed
   */
  cleanExpired() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get or set with a factory function
   * @param {string} key - Cache key
   * @param {Function} factory - Function to generate value if not cached
   * @param {number} ttl - Time to live
   * @returns {*} Cached or newly generated value
   */
  async getOrSet(key, factory, ttl = this.defaultTTL) {
    let value = this.get(key);
    if (value !== undefined) {
      return value;
    }

    value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

// Create shared cache instances
const userCache = new LRUCache(500, 1800000); // 30 minutes
const sessionCache = new LRUCache(200, 3600000); // 1 hour
const profileCache = new LRUCache(300, 1800000); // 30 minutes
const conversationCache = new LRUCache(200, 900000); // 15 minutes

module.exports = {
  LRUCache,
  userCache,
  sessionCache,
  profileCache,
  conversationCache
};
