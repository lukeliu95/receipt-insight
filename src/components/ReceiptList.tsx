import { motion } from 'framer-motion';
import type { Receipt } from '../types';

interface ReceiptListProps {
    receipts: Receipt[];
    onReceiptClick: (receipt: Receipt) => void;
}

export function ReceiptList({ receipts, onReceiptClick }: ReceiptListProps) {
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
            return dateString;
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
        const key = new Date(r.date).toLocaleDateString('zh-CN');
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
    }, {});

    return (
        <div className="px-4 pt-2 pb-8 space-y-6">
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
                        {dayReceipts.map((receipt, i) => (
                            <motion.div
                                key={receipt.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => onReceiptClick(receipt)}
                                className="bg-white rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform shadow-sm border border-stone-50"
                            >
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
                                        {formatTime(receipt.date)} · {receipt.items.length} 件商品
                                        {receipt.status === 'processing' && (
                                            <span className="ml-1 text-primary">分析中...</span>
                                        )}
                                        {receipt.status === 'error' && (
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
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
