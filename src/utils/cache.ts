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
                // Clear all pharmai cache entries to make room
                console.warn('[Cache] Storage full, clearing old entries...');
                Object.keys(localStorage)
                    .filter(k => k.startsWith(CACHE_PREFIX))
                    .forEach(k => localStorage.removeItem(k));

                // Retry saving
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(item));
                } catch (retryError) {
                    console.warn("[Cache] Storage still full, data not cached.");
                }
            } else {
                throw e;
            }
        }
    } catch (e) {
        console.warn(`[Cache] Error saving ${key}`, e);
    }

    return data;
};

export const clearCache = (prefix?: string) => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix ? `${CACHE_PREFIX}${prefix}` : CACHE_PREFIX)) {
            localStorage.removeItem(key);
        }
    });
};
