// Web Worker for handling heavy data processing

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'processInventoryFilter') {
        const { items, query, category } = payload;

        // Simulating heavy work on large dataset
        const filtered = items.filter((item: any) => {
            const matchesSearch = !query ||
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                item.description?.toLowerCase().includes(query.toLowerCase());

            const matchesCategory = !category || category === 'All' || item.category === category;

            return matchesSearch && matchesCategory;
        });

        self.postMessage({ type: 'processInventoryFilterResult', result: filtered });
    }

    if (type === 'processSalesAnalytics') {
        const { sales } = payload;
        // Heavy aggregation logic
        const totalRevenue = sales.reduce((sum: number, s: any) => sum + s.total_amount, 0);
        const byDate = sales.reduce((acc: any, s: any) => {
            const date = new Date(s.created_at).toLocaleDateString();
            acc[date] = (acc[date] || 0) + s.total_amount;
            return acc;
        }, {});

        self.postMessage({
            type: 'processSalesAnalyticsResult',
            result: { totalRevenue, byDate }
        });
    }
};
