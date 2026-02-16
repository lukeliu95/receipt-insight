import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Receipt } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReceiptAnalysisProps {
    receipt: Receipt;
    analysis: string;
    isLoading: boolean;
    onClose: () => void;
}

export function ReceiptAnalysis({ receipt, analysis, isLoading, onClose }: ReceiptAnalysisProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl"
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-stone-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pb-3 flex justify-between items-center border-b border-stone-100">
                    <div>
                        <h2 className="font-black text-base">{receipt.storeName}</h2>
                        <p className="text-xs text-text-muted">
                            {receipt.currency}{receipt.total.toFixed(0)} · {receipt.items.length} 件商品
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Analysis Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-primary font-medium">
                                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                AI 正在分析你的消费...
                            </div>
                            <div className="space-y-2 animate-pulse">
                                <div className="h-3 bg-stone-100 rounded w-full" />
                                <div className="h-3 bg-stone-100 rounded w-4/5" />
                                <div className="h-3 bg-stone-100 rounded w-3/4" />
                                <div className="h-8 bg-stone-50 rounded-xl w-full mt-4" />
                                <div className="h-3 bg-stone-100 rounded w-5/6" />
                                <div className="h-3 bg-stone-100 rounded w-2/3" />
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-sm prose-orange max-w-none text-text-main leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
                    <button
                        onClick={onClose}
                        className="w-full bg-primary text-white font-bold py-3 rounded-2xl text-sm active:scale-[0.98] transition-transform"
                    >
                        知道了
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
