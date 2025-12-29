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

        saveToLocalStorage(cacheKey, item);

    } catch (e) {
        console.warn(`[Cache] Unexpected error saving ${key}`, e);
    }

    return data;
};

const saveToLocalStorage = (key: string, item: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(item));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn('[Cache] Storage full, attempting eviction...');

            // Strategy 1: Evict Expired Items FIRST (Cleanup)
            // Strategy 2: Evict oldest 50%
            // Strategy 3: Nuke all app cache

            if (performEviction()) {
                try {
                    localStorage.setItem(key, JSON.stringify(item));
                    console.log('[Cache] Successfully saved after eviction.');
                } catch (retryError) {
                    console.warn("[Cache] Still full after partial eviction. Clearing ALL app cache.");
                    clearCache();
                    try {
                        localStorage.setItem(key, JSON.stringify(item));
                    } catch (finalError) {
                        console.error("[Cache] Critical: LocalStorage completely full/blocked.");
                    }
                }
            }
        } else {
            console.debug(`[Cache] Error saving ${key}`, e);
        }
    }
};

const performEviction = (): boolean => {
    try {
        const cacheEntries = Object.keys(localStorage)
            .filter(k => k.startsWith(CACHE_PREFIX))
            .map(k => {
                try {
                    const val = JSON.parse(localStorage.getItem(k) || '');
                    return { key: k, timestamp: val.timestamp || 0 };
                } catch {
                    return { key: k, timestamp: 0 };
                }
            })
            .sort((a, b) => a.timestamp - b.timestamp);

        if (cacheEntries.length === 0) return false;

        // Evict oldest 50%
        const evictionCount = Math.max(1, Math.ceil(cacheEntries.length * 0.5));
        for (let i = 0; i < evictionCount; i++) {
            if (cacheEntries[i]) {
                localStorage.removeItem(cacheEntries[i].key);
            }
        }
        return true;
    } catch (err) {
        console.error('Eviction failed', err);
        return false;
    }
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
    const targetPrefix = prefix ? `${CACHE_PREFIX}${prefix}` : CACHE_PREFIX;
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(targetPrefix)) {
            localStorage.removeItem(key);
        }
    });
};
