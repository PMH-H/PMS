import React from 'react';

interface Article {
    id: string;
    title: string;
    content: string;
    author?: string;
    image_url?: string;
    created_at?: string;
}

interface ArticleViewerProps {
    article: Article;
    onClose: () => void;
}

const ArticleViewer: React.FC<ArticleViewerProps> = ({ article, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl h-[90vh] flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                {/* Header Image */}
                <div className="relative h-64 sm:h-80 bg-gray-100 flex-shrink-0">
                    {article.image_url ? (
                        <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
                            <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/80 p-2 rounded-full shadow-sm hover:bg-white transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 pt-20">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight shadow-sm">{article.title}</h2>
                        {article.author && <p className="text-white/80 text-sm mt-2 font-medium">By {article.author}</p>}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 sm:p-8 bg-white">
                    <div className="prose prose-slate max-w-none">
                        {article.content.split('\n').map((paragraph, idx) => (
                            paragraph.trim() && <p key={idx} className="mb-4 text-slate-700 leading-relaxed text-lg">{paragraph}</p>
                        ))}
                    </div>
                    {article.created_at && (
                        <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-400">
                            Published on {new Date(article.created_at).toLocaleDateString()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArticleViewer;
