/**
 * Generic caching utility using localStorage with Time-To-Live (TTL)
 */

interface CacheItem<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

const CACHE_PREFIX = 'pharmai_cache_';

export const fetchWithCache = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000 // Default 5 minutes
): Promise<T> => {
    const cacheKey = `${CACHE_PREFIX}${key}`;

    // 1. Try to get from cache
    try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
            const cached: CacheItem<T> = JSON.parse(cachedStr);
            const now = Date.now();

            // Check if valid and not expired
            if (now - cached.timestamp < cached.ttl) {
                // console.debug(`[Cache] Hit for ${key}`);
                return cached.data;
            } else {
                // console.debug(`[Cache] Expired for ${key}`);
                localStorage.removeItem(cacheKey);
            }
        }
    } catch (e) {
        console.warn(`[Cache] Error reading ${key}`, e);
    }

    // 2. Fetch fresh data
    // console.debug(`[Cache] Miss/Fetch for ${key}`);
    const data = await fetcher();

    // 3. Save to cache with Quota Handling
    try {
        const item: CacheItem<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        };
        try {
            localStorage.setItem(cacheKey, JSON.stringify(item));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('[Cache] Storage full, attempting LRU eviction...');

                // Get all cache keys and sort by timestamp (older first)
                const cacheEntries = Object.keys(localStorage)
                    .filter(k => k.startsWith(CACHE_PREFIX))
                    .map(k => {
                        try {
                            const val = JSON.parse(localStorage.getItem(k) || '');
                            return { key: k, timestamp: val.timestamp };
                        } catch {
                            return { key: k, timestamp: 0 };
                        }
                    })
                    .sort((a, b) => a.timestamp - b.timestamp);

                // Evict oldest 20% items
                const evictionCount = Math.max(1, Math.floor(cacheEntries.length * 0.2));
                for (let i = 0; i < evictionCount; i++) {
                    localStorage.removeItem(cacheEntries[i].key);
                }

                // Retry one last time
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(item));
                } catch (retryError) {
                    console.warn("[Cache] Storage still full after eviction, skipping cache write.");
                }
            } else {
                // Ignore other errors (e.g. security/privacy blocking)
                console.debug(`[Cache] Error saving ${key}`, e);
            }
        }
    } catch (e) {
        console.warn(`[Cache] Unexpected error saving ${key}`, e);
    }

    return data;
};

/**
 * Synchronously retrieves cached data.
 * Useful for initializing state with cached content to avoid loading spinners.
 * @param key Cache key
 * @param ignoreTTL If true, returns data even if expired (stale-while-revalidate pattern)
 */
export const getCacheSync = <T>(key: string, ignoreTTL = true): T | null => {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    try {
        const item = localStorage.getItem(cacheKey);
        if (item) {
            const parsed: CacheItem<T> = JSON.parse(item);

            if (ignoreTTL) {
                return parsed.data;
            }

            const now = Date.now();
            if (now - parsed.timestamp < parsed.ttl) {
                return parsed.data;
            }
        }
    } catch {
        return null;
    }
    return null;
};

export const clearCache = (prefix?: string) => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix ? `${CACHE_PREFIX}${prefix}` : CACHE_PREFIX)) {
            localStorage.removeItem(key);
        }
    });
};
