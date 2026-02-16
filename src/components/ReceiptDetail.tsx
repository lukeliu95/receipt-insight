import { useState, useEffect } from 'react';
import type { Receipt } from '../types';
import { ArrowLeft, Leaf, Trash2, X, Maximize2, ImageIcon } from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReceiptDetailProps {
    receipt: Receipt;
    onClose: () => void;
}

export function ReceiptDetail({ receipt, onClose }: ReceiptDetailProps) {
    const { removeReceipt, updateReceiptData } = useReceiptStore();
    const [isImageZoomed, setIsImageZoomed] = useState(false);
    const [analysis, setAnalysis] = useState(receipt.analysis || '');
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    // Lazy load image
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageRequested, setImageRequested] = useState(false);

    const loadImage = async () => {
        if (imageUrl || imageLoading) return;
        setImageLoading(true);
        setImageRequested(true);
        try {
            const url = await api.getReceiptImage(receipt.id);
            setImageUrl(url);
        } catch (e) {
            console.error('Failed to load image:', e);
        } finally {
            setImageLoading(false);
        }
    };

    const handleDelete = async () => {
        if (confirm('确定要删除这张小票吗？')) {
            await removeReceipt(receipt.id);
            onClose();
        }
    };

    const handleReAnalyze = async () => {
        setLoadingAnalysis(true);
        try {
            const result = await api.processReceipt(receipt.id);
            const newAnalysis = result.receipt.analysis || '';
            setAnalysis(newAnalysis);
            updateReceiptData(receipt.id, {
                storeName: result.receipt.storeName,
                date: result.receipt.date,
                total: result.receipt.total,
                currency: result.receipt.currency,
                items: result.receipt.items || [],
                analysis: newAnalysis,
                status: 'completed'
            });
        } catch (e) {
            console.error(e);
            setAnalysis('重新分析失败，请稍后再试。');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(dateString));
        } catch {
            return dateString;
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-0 z-50 bg-background flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-stone-100 sticky top-0 z-10">
                    <button onClick={onClose} className="flex items-center gap-1.5 text-text-main font-medium">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">返回</span>
                    </button>
                    <span className="font-bold text-sm">小票详情</span>
                    <button onClick={handleDelete} className="p-2 text-stone-400 hover:text-danger rounded-full">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable */}
                <div className="flex-1 overflow-y-auto">
                    {/* 图片区域：点击加载 */}
                    <div className="relative h-48 bg-stone-50 flex items-center justify-center">
                        {imageUrl ? (
                            <div className="w-full h-full" onClick={() => setIsImageZoomed(true)}>
                                <img src={imageUrl} alt="" className="w-full h-full object-contain" />
                                <button className="absolute bottom-3 right-3 p-1.5 bg-black/60 rounded-full text-white">
                                    <Maximize2 className="w-4 h-4" />
                                </button>
                            </div>
                        ) : imageLoading ? (
                            <div className="flex flex-col items-center gap-2 text-stone-400">
                                <div className="w-6 h-6 border-2 border-stone-300 border-t-primary rounded-full animate-spin" />
                                <span className="text-xs">加载图片中...</span>
                            </div>
                        ) : (
                            <button
                                onClick={loadImage}
                                className="flex flex-col items-center gap-2 text-stone-400 active:text-primary transition-colors"
                            >
                                <ImageIcon className="w-8 h-8" />
                                <span className="text-xs font-medium">点击查看小票原图</span>
                            </button>
                        )}
                    </div>

                    <div className="p-5 space-y-5">
                        {/* 主要信息 */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-xl font-black">{receipt.storeName}</h1>
                                <p className="text-xs text-text-muted mt-1">{formatDate(receipt.date)}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-primary">
                                    {receipt.currency}{receipt.total.toFixed(0)}
                                </span>
                            </div>
                        </div>

                        {/* 商品列表 */}
                        <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-50">
                            {receipt.items.map((item) => (
                                <div key={item.id} className="p-3.5">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-semibold text-sm">{item.name}</span>
                                        <span className="font-mono text-sm font-medium text-text-muted">
                                            {receipt.currency}{item.price.toFixed(0)}
                                        </span>
                                    </div>
                                    {item.description && (
                                        <p className="text-xs text-text-muted">{item.description}</p>
                                    )}
                                    {item.nutrition && (
                                        <div className="mt-1.5 bg-orange-50 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                                            <Leaf className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                            <span className="text-xs text-orange-800">{item.nutrition}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* AI 分析 */}
                        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                            <div className="px-4 py-3 bg-primary/5 flex justify-between items-center">
                                <span className="text-sm font-bold">AI 分析</span>
                                <button
                                    onClick={handleReAnalyze}
                                    disabled={loadingAnalysis}
                                    className="text-xs text-primary font-medium disabled:opacity-50"
                                >
                                    {loadingAnalysis ? '分析中...' : '重新分析'}
                                </button>
                            </div>
                            <div className="p-4 text-sm text-text-muted leading-relaxed">
                                {loadingAnalysis ? (
                                    <div className="space-y-2 animate-pulse">
                                        <div className="h-3 bg-stone-100 rounded w-3/4" />
                                        <div className="h-3 bg-stone-100 rounded w-full" />
                                        <div className="h-3 bg-stone-100 rounded w-5/6" />
                                    </div>
                                ) : analysis ? (
                                    <div className="prose prose-sm prose-orange max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-center text-stone-400">点击"重新分析"生成 AI 洞察</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Image Zoom */}
            <AnimatePresence>
                {isImageZoomed && imageUrl && (
                    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center" onClick={() => setIsImageZoomed(false)}>
                        <button className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white">
                            <X className="w-5 h-5" />
                        </button>
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            src={imageUrl}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
