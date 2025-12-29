export class CacheService {
    private static instance: CacheService;
    private cache: Map<string, { value: any; expiry: number }> = new Map();

    private constructor() { }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public set(key: string, value: any, ttlSeconds: number = 300): void {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiry });
    }

    public get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value as T;
    }

    public delete(key: string): void {
        this.cache.delete(key);
    }

    public flush(): void {
        this.cache.clear();
    }
}

export const cacheService = CacheService.getInstance();
