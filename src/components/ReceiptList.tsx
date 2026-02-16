import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, CheckSquare, Square, X } from 'lucide-react';
import type { Receipt } from '../types';
import { useReceiptStore } from '../store/useReceiptStore';

interface ReceiptListProps {
    receipts: Receipt[];
    onReceiptClick: (receipt: Receipt) => void;
    onReprocess: (receipt: Receipt) => void;
}

export function ReceiptList({ receipts, onReceiptClick, onReprocess }: ReceiptListProps) {
    const { removeReceipt, removeReceipts } = useReceiptStore();
    const [editMode, setEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [swipedId, setSwipedId] = useState<string | null>(null);
    const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set());

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = () => {
        if (selectedIds.size === receipts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(receipts.map(r => r.id)));
        }
    };

    const exitEditMode = () => {
        setEditMode(false);
        setSelectedIds(new Set());
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!confirm(`确定删除选中的 ${count} 张小票吗？`)) return;
        await removeReceipts(Array.from(selectedIds));
        exitEditMode();
    };

    const handleBatchReprocess = async () => {
        const selected = receipts.filter(r => selectedIds.has(r.id));
        exitEditMode();
        for (const r of selected) {
            onReprocess(r);
        }
    };

    const handleSingleDelete = async (id: string) => {
        if (!confirm('确定删除这张小票吗？')) return;
        setSwipedId(null);
        await removeReceipt(id);
    };

    const handleSingleReprocess = async (receipt: Receipt) => {
        setReprocessingIds(prev => new Set(prev).add(receipt.id));
        setSwipedId(null);
        try {
            await onReprocess(receipt);
        } finally {
            setReprocessingIds(prev => {
                const next = new Set(prev);
                next.delete(receipt.id);
                return next;
            });
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const d = new Date(dateString);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return '今天';
            if (diffDays === 1) return '昨天';
            if (diffDays === 2) return '前天';

            return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        } catch {
            return dateString || '未知日期';
        }
    };

    const formatTime = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '';
        }
    };

    // 按日期分组
    const grouped = receipts.reduce<Record<string, Receipt[]>>((acc, r) => {
        const key = r.date ? new Date(r.date).toLocaleDateString('zh-CN') : '处理中';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
    }, {});

    return (
        <div className="px-4 pt-2 pb-8">
            {/* 顶部操作栏 */}
            <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-bold text-text-main">
                    共 {receipts.length} 张小票
                </span>
                {editMode ? (
                    <button
                        onClick={exitEditMode}
                        className="flex items-center gap-1 text-sm text-primary font-medium"
                    >
                        <X className="w-4 h-4" />
                        取消
                    </button>
                ) : (
                    <button
                        onClick={() => setEditMode(true)}
                        className="text-sm text-primary font-medium"
                    >
                        编辑
                    </button>
                )}
            </div>

            {/* 列表 */}
            <div className="space-y-6">
                {Object.entries(grouped).map(([dateKey, dayReceipts]) => (
                    <div key={dateKey}>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                {formatDate(dayReceipts[0].date)}
                            </span>
                            <span className="text-xs text-text-muted">
                                {dayReceipts.filter(r => r.status === 'completed').reduce((s, r) => s + r.total, 0).toFixed(0)} {dayReceipts[0]?.currency || '¥'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {dayReceipts.map((receipt, i) => {
                                const isSelected = selectedIds.has(receipt.id);
                                const isSwiped = swipedId === receipt.id;
                                const isReprocessing = reprocessingIds.has(receipt.id);

                                return (
                                    <div key={receipt.id} className="relative overflow-hidden rounded-2xl">
                                        {/* 滑动后露出的操作按钮 */}
                                        <AnimatePresence>
                                            {isSwiped && !editMode && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute right-0 top-0 bottom-0 flex items-stretch z-10"
                                                >
                                                    <button
                                                        onClick={() => handleSingleReprocess(receipt)}
                                                        className="w-16 bg-primary flex flex-col items-center justify-center gap-1 text-white"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                        <span className="text-[10px]">重新识别</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleSingleDelete(receipt.id)}
                                                        className="w-16 bg-red-500 flex flex-col items-center justify-center gap-1 text-white"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        <span className="text-[10px]">删除</span>
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{
                                                opacity: 1,
                                                y: 0,
                                                x: isSwiped && !editMode ? -128 : 0
                                            }}
                                            transition={i === 0 ? { delay: 0 } : { delay: i * 0.03 }}
                                            onClick={() => {
                                                if (isSwiped) {
                                                    setSwipedId(null);
                                                    return;
                                                }
                                                if (editMode) {
                                                    toggleSelect(receipt.id);
                                                } else {
                                                    onReceiptClick(receipt);
                                                }
                                            }}
                                            onPanEnd={(_e, info) => {
                                                if (editMode) return;
                                                if (info.offset.x < -60) {
                                                    setSwipedId(receipt.id);
                                                } else if (info.offset.x > 30) {
                                                    setSwipedId(null);
                                                }
                                            }}
                                            drag={editMode ? false : "x"}
                                            dragConstraints={{ left: -128, right: 0 }}
                                            dragElastic={0.1}
                                            dragSnapToOrigin={false}
                                            className="bg-white rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform shadow-sm border border-stone-50 relative z-20"
                                        >
                                            {/* 选择框 */}
                                            {editMode && (
                                                <div className="shrink-0">
                                                    {isSelected ? (
                                                        <CheckSquare className="w-5 h-5 text-primary" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-stone-300" />
                                                    )}
                                                </div>
                                            )}

                                            {/* 左侧图标/缩略图 */}
                                            <div className="w-11 h-11 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 overflow-hidden">
                                                {receipt.imageUrl ? (
                                                    <img src={receipt.imageUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-lg">🧾</span>
                                                )}
                                            </div>

                                            {/* 中间信息 */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm text-text-main truncate">
                                                    {receipt.storeName || '未知商家'}
                                                </div>
                                                <div className="text-xs text-text-muted mt-0.5">
                                                    {receipt.date ? formatTime(receipt.date) : ''} · {receipt.items.length} 件商品
                                                    {(receipt.status === 'processing' || receipt.status === 'pending' || isReprocessing) && (
                                                        <span className="ml-1 text-primary">
                                                            {isReprocessing ? '重新识别中...' : '分析中...'}
                                                        </span>
                                                    )}
                                                    {receipt.status === 'error' && !isReprocessing && (
                                                        <span className="ml-1 text-danger">识别失败</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 右侧金额 */}
                                            <div className="text-right shrink-0">
                                                <div className="font-bold text-base text-text-main">
                                                    {receipt.currency}{receipt.total.toFixed(0)}
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* 批量操作栏 */}
            <AnimatePresence>
                {editMode && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-20 left-0 right-0 z-50 px-4"
                    >
                        <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-3 flex items-center gap-2 max-w-md mx-auto">
                            <button
                                onClick={selectAll}
                                className="flex-1 py-2.5 text-sm font-medium text-text-main bg-stone-50 rounded-xl active:bg-stone-100 transition-colors"
                            >
                                {selectedIds.size === receipts.length ? '取消全选' : '全选'}
                            </button>
                            <button
                                onClick={handleBatchReprocess}
                                disabled={selectedIds.size === 0}
                                className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-xl disabled:opacity-40 active:opacity-80 transition-opacity flex items-center justify-center gap-1"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                重新识别{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                disabled={selectedIds.size === 0}
                                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl disabled:opacity-40 active:opacity-80 transition-opacity flex items-center justify-center gap-1"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                删除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
