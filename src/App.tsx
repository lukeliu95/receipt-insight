import { useState, useEffect } from 'react';
import { Home, BarChart3, Camera, Images, LogOut } from 'lucide-react';
import { useReceiptStore } from './store/useReceiptStore';
import { useAuthStore } from './store/useAuthStore';
import { ReceiptList } from './components/ReceiptList';
import { OnboardingView } from './components/OnboardingView';
import { MagicScan } from './components/MagicScan';
import { BatchProgress } from './components/BatchProgress';
import { ReceiptDetail } from './components/ReceiptDetail';
import { WeeklyReportView } from './components/WeeklyReportView';
import { ReceiptAnalysis } from './components/ReceiptAnalysis';
import { LoginPage } from './components/auth/LoginPage';
import { processReceiptImage, generateReceiptAnalysis } from './services/gemini';
import { clsx } from 'clsx';
import type { Receipt } from './types';
import { AnimatePresence } from 'framer-motion';

function App() {
  const { receipts, isScanning, setScanning, addReceipt, updateReceiptData, updateReceiptStatus, loadReceipts, clearReceipts, getRecentReceipts } = useReceiptStore();
  const { user, isLoading: authLoading, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'home' | 'report'>('home');
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // 扫描完成后的分析结果
  const [analysisReceipt, setAnalysisReceipt] = useState<Receipt | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 批量处理进度
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchDone, setBatchDone] = useState(0);

  // 拍照/相册选择菜单
  const [showPickerMenu, setShowPickerMenu] = useState(false);

  useEffect(() => {
    if (user) loadReceipts();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 处理单张小票（带扫描动画 + 分析弹窗）
  const processSingle = async (base64: string) => {
    setScanning(true);
    setScanImage(base64);

    const tempId = Date.now().toString();
    addReceipt({
      id: tempId, imageUrl: base64, storeName: '正在分析...', date: new Date().toISOString(),
      createdAt: new Date().toISOString(), currency: '¥', total: 0, items: [], status: 'processing'
    });

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await processReceiptImage(base64);
      if (result) {
        updateReceiptData(tempId, result);
        updateReceiptStatus(tempId, 'completed');

        const fullReceipt: Receipt = {
          id: tempId, imageUrl: base64,
          storeName: result.storeName || '未知商家', date: result.date || new Date().toISOString(),
          currency: result.currency || '¥', total: result.total || 0,
          items: result.items || [], status: 'completed'
        };

        setScanning(false);
        setScanImage(null);

        setAnalysisReceipt(fullReceipt);
        setIsAnalyzing(true);
        try {
          const recentReceipts = getRecentReceipts(3);
          const analysis = await generateReceiptAnalysis(fullReceipt, recentReceipts);
          setAnalysisText(analysis);
          updateReceiptData(tempId, { analysis });
        } catch (err) {
          console.error('Analysis failed:', err);
          setAnalysisText('分析生成失败，请稍后查看详情重新生成。');
        } finally {
          setIsAnalyzing(false);
        }
      }
    } catch (error) {
      console.error(error);
      updateReceiptStatus(tempId, 'error');
      updateReceiptData(tempId, { storeName: '识别失败' });
      setScanning(false);
      setScanImage(null);
    }
  };

  // 批量处理多张小票（后台逐张处理，显示进度条）
  const processBatch = async (files: File[]) => {
    const images = await Promise.all(files.map(readFileAsBase64));
    setBatchTotal(images.length);
    setBatchDone(0);

    for (let i = 0; i < images.length; i++) {
      const base64 = images[i];
      const tempId = Date.now().toString() + Math.random().toString(36).slice(2);

      addReceipt({
        id: tempId, imageUrl: base64, storeName: '正在分析...', date: new Date().toISOString(),
        createdAt: new Date().toISOString(), currency: '¥', total: 0, items: [], status: 'processing'
      });

      try {
        const result = await processReceiptImage(base64);
        if (result) {
          updateReceiptData(tempId, result);
          updateReceiptStatus(tempId, 'completed');
        }
      } catch (error) {
        console.error(error);
        updateReceiptStatus(tempId, 'error');
        updateReceiptData(tempId, { storeName: '识别失败' });
      }

      setBatchDone(i + 1);
    }

    // 清除进度
    setTimeout(() => { setBatchTotal(0); setBatchDone(0); }, 2000);
  };

  // 拍照（单张，调用摄像头）
  const handleTakePhoto = () => {
    setShowPickerMenu(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const base64 = await readFileAsBase64(file);
      await processSingle(base64);
    };
    input.click();
  };

  // 从相册选择（支持多选）
  const handlePickFromAlbum = () => {
    setShowPickerMenu(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      if (files.length === 1) {
        const base64 = await readFileAsBase64(files[0]);
        await processSingle(base64);
      } else {
        await processBatch(files);
      }
    };
    input.click();
  };

  // 点击中间按钮 → 弹出选择菜单
  const handleCameraClick = () => {
    if (isScanning || batchTotal > 0) return;
    setShowPickerMenu(true);
  };

  return (
    <div className="min-h-screen bg-background text-text-main font-sans">
      {/* Header - 极简 */}
      <header className="fixed top-0 w-full z-40 bg-white/90 backdrop-blur-md border-b border-stone-100 px-5 py-3 flex justify-between items-center">
        <h1 className="text-lg font-black tracking-tight">
          <span className="text-primary">花</span>在哪里了
        </h1>
        <button
          onClick={() => { logout(); clearReceipts(); }}
          className="p-2 text-stone-400 hover:text-danger rounded-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Content */}
      <main className="pt-14 pb-24 min-h-screen">
        {activeTab === 'home' && (
          receipts.length === 0 && !isScanning ? (
            <OnboardingView onStart={handleCameraClick} />
          ) : (
            <ReceiptList
              receipts={receipts}
              onReceiptClick={setSelectedReceipt}
            />
          )
        )}
        {activeTab === 'report' && <WeeklyReportView receipts={receipts} />}
      </main>

      {/* Scanning Overlay (单张) */}
      {isScanning && scanImage && <MagicScan image={scanImage} />}

      {/* Batch Progress (多张) */}
      <AnimatePresence>
        {batchTotal > 0 && <BatchProgress total={batchTotal} done={batchDone} />}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {selectedReceipt && (
          <ReceiptDetail
            receipt={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
          />
        )}
        {analysisReceipt && (
          <ReceiptAnalysis
            receipt={analysisReceipt}
            analysis={analysisText}
            isLoading={isAnalyzing}
            onClose={() => { setAnalysisReceipt(null); setAnalysisText(''); }}
          />
        )}
      </AnimatePresence>

      {/* 拍照/相册 选择菜单 */}
      <AnimatePresence>
        {showPickerMenu && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowPickerMenu(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative w-full max-w-md px-4 pb-8" onClick={e => e.stopPropagation()}>
              <div className="bg-white rounded-2xl overflow-hidden shadow-xl mb-3">
                <button
                  onClick={handleTakePhoto}
                  className="w-full flex items-center gap-3 px-5 py-4 text-text-main font-medium active:bg-stone-50 transition-colors border-b border-stone-100"
                >
                  <Camera className="w-5 h-5 text-primary" />
                  拍照
                </button>
                <button
                  onClick={handlePickFromAlbum}
                  className="w-full flex items-center gap-3 px-5 py-4 text-text-main font-medium active:bg-stone-50 transition-colors"
                >
                  <Images className="w-5 h-5 text-primary" />
                  从相册选择（可多选）
                </button>
              </div>
              <button
                onClick={() => setShowPickerMenu(false)}
                className="w-full bg-white rounded-2xl py-3.5 text-center font-bold text-text-muted shadow-xl active:bg-stone-50"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 bg-white/90 backdrop-blur-xl border-t border-stone-100 pb-safe">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={clsx(
              "flex flex-col items-center gap-0.5 transition-colors min-w-[60px]",
              activeTab === 'home' ? "text-primary" : "text-stone-400"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">首页</span>
          </button>

          {/* 中间大拍照按钮 */}
          <button
            onClick={handleCameraClick}
            disabled={isScanning || batchTotal > 0}
            className="relative -mt-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Camera className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={clsx(
              "flex flex-col items-center gap-0.5 transition-colors min-w-[60px]",
              activeTab === 'report' ? "text-primary" : "text-stone-400"
            )}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium">统计</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
