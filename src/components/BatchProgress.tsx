import { motion } from 'framer-motion';

interface BatchProgressProps {
    total: number;
    done: number;
}

export function BatchProgress({ total, done }: BatchProgressProps) {
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const isComplete = done >= total;

    return (
        <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-16 left-4 right-4 z-50"
        >
            <div className="bg-white rounded-2xl shadow-lg border border-stone-100 p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-text-main">
                        {isComplete ? '全部完成' : '批量识别中...'}
                    </span>
                    <span className="text-xs text-text-muted font-medium">
                        {done}/{total}
                    </span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                {!isComplete && (
                    <p className="text-xs text-text-muted mt-2">
                        正在处理第 {done + 1} 张，共 {total} 张
                    </p>
                )}
            </div>
        </motion.div>
    );
}
