import { useState, useMemo, useEffect } from 'react';
import { Copy, Share2 } from 'lucide-react';
import type { Receipt } from '../types';
import { generateReport, type ReportPeriod } from '../services/gemini';
import { reportApi } from '../services/api';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReportViewProps {
    receipts: Receipt[];
}

const PERIODS: { key: ReportPeriod; label: string; days: number | null }[] = [
    { key: 'week', label: '本周', days: 7 },
    { key: 'month', label: '本月', days: 30 },
    { key: 'all', label: '全部', days: null },
];

export function WeeklyReportView({ receipts }: ReportViewProps) {
    const [period, setPeriod] = useState<ReportPeriod>('week');
    const [reports, setReports] = useState<Record<string, string>>({});
    const [updatedAts, setUpdatedAts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [loadingFromServer, setLoadingFromServer] = useState(false);

    // 按周期过滤小票
    const filteredReceipts = useMemo(() => {
        const completed = receipts.filter(r => r.status === 'completed');
        const cfg = PERIODS.find(p => p.key === period)!;
        if (!cfg.days) return completed;
        const cutoff = new Date(Date.now() - cfg.days * 24 * 60 * 60 * 1000);
        return completed.filter(r => new Date(r.date) >= cutoff);
    }, [receipts, period]);

    const totalSpent = filteredReceipts.reduce((s, r) => s + r.total, 0);
    const currency = filteredReceipts[0]?.currency || '¥';
    const cfg = PERIODS.find(p => p.key === period)!;
    const days = cfg.days || Math.max(1, Math.ceil((Date.now() - new Date(filteredReceipts[filteredReceipts.length - 1]?.date || Date.now()).getTime()) / (1000 * 60 * 60 * 24)));

    const currentReport = reports[period] || '';
    const currentUpdatedAt = updatedAts[period] || '';

    // 切换 tab 时从服务器加载已保存的报告
    useEffect(() => {
        if (reports[period] !== undefined) return; // 已加载过，跳过
        const loadFromServer = async () => {
            setLoadingFromServer(true);
            try {
                const { content, updatedAt } = await reportApi.getReport(period);
                if (content) {
                    setReports(prev => ({ ...prev, [period]: content }));
                    setUpdatedAts(prev => ({ ...prev, [period]: updatedAt || '' }));
                } else {
                    setReports(prev => ({ ...prev, [period]: '' }));
                }
            } catch (e) {
                console.error('Load report error:', e);
                setReports(prev => ({ ...prev, [period]: '' }));
            } finally {
                setLoadingFromServer(false);
            }
        };
        loadFromServer();
    }, [period]);

    const handleGenerate = async () => {
        if (filteredReceipts.length === 0) return;
        setLoading(true);
        try {
            const result = await generateReport(filteredReceipts, period);
            setReports(prev => ({ ...prev, [period]: result }));
            // 保存到服务器
            try {
                const { updatedAt } = await reportApi.saveReport(period, result);
                setUpdatedAts(prev => ({ ...prev, [period]: updatedAt }));
            } catch (saveErr) {
                console.error('Save report error:', saveErr);
            }
        } catch (e) {
            console.error(e);
            setReports(prev => ({ ...prev, [period]: '报告生成失败，请重试。' }));
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (currentReport) navigator.clipboard.writeText(currentReport);
    };

    const handleShare = async () => {
        if (!currentReport) return;
        if (navigator.share) {
            try { await navigator.share({ title: `花在哪里了 - ${cfg.label}报告`, text: currentReport }); } catch { /* */ }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="px-4 pt-2 pb-8 space-y-4 animate-fade-up">
            {/* 周期切换 Tab */}
            <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={clsx(
                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                            period === p.key
                                ? "bg-white text-primary shadow-sm"
                                : "text-stone-500"
                        )}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* 总览卡片 */}
            <div className="bg-primary text-white p-5 rounded-2xl relative overflow-hidden">
                <p className="text-white/80 text-xs font-medium">{cfg.label}消费</p>
                <div className="text-3xl font-black mt-1">
                    {currency}{totalSpent.toFixed(0)}
                </div>
                <p className="text-white/60 text-xs mt-1">
                    {filteredReceipts.length} 笔消费 · 日均 {currency}{filteredReceipts.length > 0 ? (totalSpent / days).toFixed(0) : 0}
                </p>
                <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full" />
                <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-white/10 rounded-full" />
            </div>

            {/* AI 报告 */}
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-50 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-sm">AI {cfg.label}报告</span>
                        {currentUpdatedAt && !loading && (
                            <p className="text-[10px] text-stone-400 mt-0.5">
                                上次生成: {new Date(currentUpdatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {currentReport && !loading && (
                            <>
                                <button onClick={handleCopy} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full">
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button onClick={handleShare} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full">
                                    <Share2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || loadingFromServer || filteredReceipts.length === 0}
                            className="text-xs text-primary font-medium ml-2 disabled:opacity-50"
                        >
                            {loading ? '生成中...' : currentReport ? '刷新' : '生成报告'}
                        </button>
                    </div>
                </div>

                <div className="p-4 text-sm leading-relaxed">
                    {loadingFromServer ? (
                        <div className="space-y-3 animate-pulse py-4">
                            <div className="h-4 bg-stone-100 rounded w-1/3" />
                            <div className="h-3 bg-stone-100 rounded w-full" />
                            <div className="h-3 bg-stone-100 rounded w-4/5" />
                        </div>
                    ) : filteredReceipts.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3">📊</div>
                            <p className="text-text-muted">{cfg.label}暂无消费记录</p>
                            <p className="text-xs text-stone-400 mt-1">拍几张小票，报告自动生成</p>
                        </div>
                    ) : loading && !currentReport ? (
                        <div className="space-y-3 animate-pulse py-4">
                            <div className="h-4 bg-stone-100 rounded w-1/2" />
                            <div className="h-3 bg-stone-100 rounded w-full" />
                            <div className="h-3 bg-stone-100 rounded w-5/6" />
                            <div className="h-3 bg-stone-100 rounded w-3/4" />
                            <div className="h-4 bg-stone-100 rounded w-1/3 mt-4" />
                            <div className="h-3 bg-stone-100 rounded w-full" />
                            <div className="h-3 bg-stone-100 rounded w-4/5" />
                        </div>
                    ) : currentReport ? (
                        <div className="prose prose-sm prose-orange max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentReport}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3">📝</div>
                            <p className="text-text-muted">尚未生成{cfg.label}报告</p>
                            <p className="text-xs text-stone-400 mt-1">点击「生成报告」开始分析</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
