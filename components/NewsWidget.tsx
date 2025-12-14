import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface NewsItem {
    id: string;
    title: string;
    summary: string;
    published_at: string;
    source: string;
}

const NewsWidget: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const { data, error } = await supabase
                    .from('health_news')
                    .select('id, title, summary, published_at, source')
                    .order('published_at', { ascending: false })
                    .limit(3);

                if (!error && data) {
                    setNews(data);
                }
            } catch (e) {
                console.error('Failed to fetch widget news', e);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    if (loading) return <div className="h-48 bg-gray-50 rounded-xl animate-pulse"></div>;

    if (news.length === 0) return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-slate-800 mb-2">Health Updates</h3>
            <p className="text-sm text-gray-400">No recent updates.</p>
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span>Latest Health News</span>
                <span className="text-xs text-indigo-600 font-medium cursor-pointer">View All</span>
            </h3>
            <div className="space-y-4">
                {news.map(item => (
                    <div key={item.id} className="group cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{item.title}</h4>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{new Date(item.published_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{item.summary}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NewsWidget;
