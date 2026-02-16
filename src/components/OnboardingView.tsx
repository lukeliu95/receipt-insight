import { Camera } from 'lucide-react';

interface OnboardingProps {
    onStart: () => void;
}

export function OnboardingView({ onStart }: OnboardingProps) {
    return (
        <div
            onClick={onStart}
            className="flex flex-col items-center justify-center min-h-[75vh] p-8 text-center cursor-pointer animate-fade-up"
        >
            <div className="text-6xl mb-6">🧾</div>

            <h2 className="text-2xl font-black text-text-main mb-2">
                花在哪里了？
            </h2>
            <p className="text-text-muted text-sm mb-10 leading-relaxed">
                拍一张小票，AI 帮你分析<br />
                营养 + 消费，一目了然
            </p>

            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-xl shadow-primary/30 mb-4">
                <Camera className="w-9 h-9 text-white" />
            </div>
            <span className="text-xs text-text-muted font-medium">点击拍照开始</span>
        </div>
    );
}
