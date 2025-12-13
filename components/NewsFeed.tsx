import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface NewsArticle {
    id: string;
    title: string;
    summary: string;
    body: string;
    source: string;
    published_at: string;
    author?: string;
    featured_image?: string;
}

const NewsFeed: React.FC = () => {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('health_news')
                    .select('*')
                    .order('published_at', { ascending: false })
                    .limit(10);

                if (error) {
                    console.error('Error fetching news:', error);
                } else {
                    setArticles(data || []);
                }
            } catch (err) {
                console.error('Unexpected error fetching news:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <div className="max-w-4xl mx-auto text-center py-20">
                <p className="text-gray-500">No health news available at the moment.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Health News & Updates</h2>
            </div>

            <div className="grid gap-4">
                {articles.map((article) => (
                    <div
                        key={article.id}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                                    HEALTH
                                </span>
                                <span className="text-xs text-gray-400">
                                    {new Date(article.published_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold mb-2 text-gray-900">
                            {article.title}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed mb-2">
                            {article.summary || article.body?.substring(0, 150) + '...'}
                        </p>
                        {article.source && (
                            <p className="text-xs text-gray-400 italic">
                                Source: {article.source}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NewsFeed;
