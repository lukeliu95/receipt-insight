import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface MagicScanProps {
    image: string;
}

export function MagicScan({ image }: MagicScanProps) {
    const [step, setStep] = useState(0);
    const steps = ["识别商家...", "提取商品...", "分析营养...", "计算金额..."];

    useEffect(() => {
        const interval = setInterval(() => {
            setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
            <div className="relative w-64 h-80 rounded-2xl overflow-hidden border-2 border-stone-100 shadow-xl">
                <img src={image} alt="" className="w-full h-full object-cover" />
                {/* 扫描线 */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-transparent h-20 w-full animate-[scan_2s_linear_infinite]" />
            </div>

            <div className="mt-8 text-center">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={step}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="text-sm font-bold text-primary"
                    >
                        {steps[step]}
                    </motion.p>
                </AnimatePresence>
                <p className="text-xs text-text-muted mt-2">AI 正在工作中</p>
            </div>
        </div>
    );
}
