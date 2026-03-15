/**
 * IN-MEMORY LRU CACHE
 *
 * Fast key-value cache with TTL (time-to-live) and max entries.
 * Runs in-process — perfect for serverless (Vercel) where each
 * function invocation may reuse the same process for warm starts.
 *
 * For production at scale, swap this with Upstash Redis:
 *   import { Redis } from "@upstash/redis";
 *   const redis = Redis.fromEnv();
 *   cache.get(key) → redis.get(key)
 *   cache.set(key, value, ttl) → redis.set(key, value, { ex: ttl })
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class LRUCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set a cached value with TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds = 300): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a specific key.
   */
  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete all keys matching a prefix.
   */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /**
   * Get cache stats (for observability dashboard).
   */
  stats() {
    return {
      entries: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + "%"
        : "0%",
    };
  }

  /**
   * Get or set pattern — fetch from cache, or compute and cache.
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

// Singleton instances for different data types
export const patientCache = new LRUCache(100);   // Patient prompts (rarely change)
export const profileCache = new LRUCache(200);   // User profiles (role, establishment)
export const stateCache = new LRUCache(500);     // Clinical state (per conversation)
export const generalCache = new LRUCache(300);   // General purpose
