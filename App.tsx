
import React, { useState, useEffect } from 'react';
import { ImageSlot, ImageSlotType, GenerationResult } from './types';
import { analyzeImage, generateFashionMix, generateMidjourneyPromptFromImage } from './services/geminiService';
import ImageUpload from './components/ImageUpload';

const INITIAL_SLOTS: ImageSlot[] = [
  { id: 'face', label: '얼굴/헤어 레퍼런스', data: null, description: '', isProcessing: false },
  { id: 'pose', label: '포즈 레퍼런스', data: null, description: '', isProcessing: false },
];

const CLOTHING_SLOTS: ImageSlot[] = [
  { id: 'outer', label: '아우터', data: null, description: '', isProcessing: false },
  { id: 'top', label: '상의', data: null, description: '', isProcessing: false },
  { id: 'bottom', label: '하의', data: null, description: '', isProcessing: false },
  { id: 'shoes', label: '신발', data: null, description: '', isProcessing: false },
  { id: 'accessory', label: '악세서리', data: null, description: '', isProcessing: false },
];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-bold text-white">{children}</h2>
);

export default function App() {
  const [slots, setSlots] = useState<ImageSlot[]>(INITIAL_SLOTS);
  const [clothing, setClothing] = useState<ImageSlot[]>(CLOTHING_SLOTS);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('Synthesizing Editorial');
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [mjPrompt, setMjPrompt] = useState<{ positive: string, negative: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true); // Fallback if not in AI Studio environment
      }
    };
    checkApiKey();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const parseErrorMessage = (err: any) => {
    let message = err.message || '';
    try {
      const parsed = JSON.parse(message);
      message = parsed.error?.message || message;
    } catch (e) {}
    return message;
  };

  const handleUpload = async (id: ImageSlotType, file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const setter = ['face', 'pose'].includes(id) ? setSlots : setClothing;
        setter(prev => prev.map(s => s.id === id ? { ...s, data: base64, isProcessing: true } : s));
        const description = await analyzeImage(base64, id);
        setter(prev => prev.map(s => s.id === id ? { ...s, description, isProcessing: false } : s));
      } catch (err: any) {
        const message = parseErrorMessage(err);
        if (message.includes('RESOURCE_EXHAUSTED')) {
          setErrorMsg('이미지 분석 사용량이 초과되었습니다. 잠시만 기다려 주세요.');
        } else {
          setErrorMsg(`분석 실패: ${message || '이미지를 분석할 수 없습니다.'}`);
        }
        const setter = ['face', 'pose'].includes(id) ? setSlots : setClothing;
        setter(prev => prev.map(s => s.id === id ? { ...s, isProcessing: false } : s));
      }
    };
  };

  const clearAll = () => {
    setSlots(INITIAL_SLOTS);
    setClothing(CLOTHING_SLOTS);
    setAdditionalPrompt('');
    setResult(null);
    setMjPrompt(null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStatus('Preparing Session...');
    setMjPrompt(null);
    setResult(null);
    try {
      const faceSlot = slots.find(s => s.id === 'face');
      const poseSlot = slots.find(s => s.id === 'pose');
      const face = faceSlot?.data || '';
      const pose = poseSlot?.data || '';

      const cImages = clothing.filter(c => c.data).map(c => ({
        data: c.data!,
        description: c.description,
        type: c.label
      }));

      const imageUrl = await generateFashionMix({
        faceImage: face,
        faceDesc: faceSlot?.description,
        poseImage: pose,
        poseDesc: poseSlot?.description,
        clothingImages: cImages,
        additionalPrompt,
        onStatusUpdate: (status) => setGenerationStatus(status)
      });

      setResult({ imageUrl, aspectRatio: '3:4' });
    } catch (err: any) {
      const message = parseErrorMessage(err);
      if (message.includes('RESOURCE_EXHAUSTED')) {
        setErrorMsg('시스템 사용량이 초과되었습니다. 1분 정도 기다린 후 다시 시도해 주세요.');
      } else if (message.includes('SAFETY')) {
        setErrorMsg('안전 정책에 의해 생성이 차단되었습니다. 다른 이미지나 프롬프트를 사용해 주세요.');
      } else {
        setErrorMsg(`생성 실패: ${message || '알 수 없는 오류가 발생했습니다.'}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!result?.imageUrl) return;
    setIsPromptLoading(true);
    try {
      const mjp = await generateMidjourneyPromptFromImage(result.imageUrl);
      setMjPrompt(mjp);
    } catch (err: any) {
      const message = parseErrorMessage(err);
      if (message.includes('RESOURCE_EXHAUSTED')) {
        setErrorMsg('프롬프트 생성 사용량이 초과되었습니다.');
      } else {
        setErrorMsg(`프롬프트 생성 실패: ${message || '오류 발생'}`);
      }
    } finally {
      setIsPromptLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = `ai-fashion-mix-editorial-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fullMJ = mjPrompt ? `${mjPrompt.positive} --no ${mjPrompt.negative}` : "";

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter uppercase">API Key Required</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              To use the high-quality Nano Banana 2 (Gemini 3.1 Flash Image) model, you must select a paid API key from your Google Cloud project.
            </p>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-xs text-indigo-300 text-left">
              <p className="font-bold mb-1">Important Note:</p>
              <p>Please ensure your project has billing enabled. You can find more information in the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-200 transition-colors">billing documentation</a>.</p>
            </div>
          </div>
          <button
            onClick={handleOpenSelectKey}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-[0_0_30px_rgba(79,70,229,0.3)]"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-sans text-white selection:bg-indigo-600/30">
      {/* Error Toast */}
      {errorMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-red-600/90 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl border border-red-500/50">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="text-[12px] font-bold uppercase tracking-tight">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-4 text-white/50 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      <header className="relative mx-auto max-w-[1920px] px-6 pb-2 pt-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-white">AI Fashion / Item Mix</h1>
          <span className="rounded-md bg-[#4F46E5] px-2.5 py-1 text-xs font-bold tracking-wider text-white shadow-lg shadow-indigo-500/20">PRO</span>
        </div>
        <p className="text-sm font-medium text-gray-500">Gemini Image · High 품질</p>

        <button
          id="reset-session-btn"
          onClick={clearAll}
          className="mt-4 text-[10px] font-bold uppercase tracking-wider text-gray-700 transition-colors hover:text-red-500 md:absolute md:right-12 md:top-10 md:mt-0"
        >
          Reset Session
        </button>
      </header>

      <main className="mx-auto max-w-[1920px] p-6 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
        {/* Left Panel */}
        <section className="flex flex-col gap-8 lg:col-span-6">
          <div className="space-y-4">
            <SectionTitle>1. 레퍼런스 이미지</SectionTitle>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{slots.map(s => <ImageUpload key={s.id} {...s} onUpload={handleUpload} onDelete={(id) => setSlots(p => p.map(x => x.id === id ? {...x, data: null} : x))} />)}</div>
          </div>

          <div className="space-y-4">
            <SectionTitle>2. 의류 아이템</SectionTitle>
            <div className="rounded-2xl border border-white/5 bg-[#050505] p-2">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{clothing.map(c => <ImageUpload key={c.id} {...c} onUpload={handleUpload} onDelete={(id) => setClothing(p => p.map(x => x.id === id ? {...x, data: null} : x))} />)}</div>
            </div>
          </div>

          <div className="space-y-4">
            <SectionTitle>3. 추가 프롬프트</SectionTitle>
            <textarea
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="배경, 조명, 분위기 또는 특정 디테일을 입력하세요 (예: 80s Cyberpunk, Studio Soft Lighting, Vogue Style...)"
              className="h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-[13px] text-gray-300 transition-all placeholder:text-gray-700 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            id="generate-image-btn"
            onClick={handleGenerate}
            className="w-full rounded-xl bg-[#242b35] py-6 text-[16px] font-bold text-gray-200 shadow-2xl transition-all hover:bg-[#303846] active:scale-[0.98] disabled:cursor-not-allowed disabled:text-gray-500 disabled:opacity-50 disabled:active:scale-100"
            disabled={isGenerating}
          >
            {isGenerating ? "이미지 생성 중..." : "2K 이미지 생성"}
          </button>
        </section>

        {/* Right Panel */}
        <section className="space-y-8 lg:col-span-6">
          <div className="flex items-center justify-between">
            <SectionTitle>4. 생성 결과</SectionTitle>
            {result && (
              <button
                id="header-download-btn"
                onClick={handleDownload}
                className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] font-bold text-gray-300 transition-all hover:border-indigo-500/30 hover:bg-white/[0.06] active:scale-95"
              >
                <svg className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download PNG</span>
              </button>
            )}
          </div>

          <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02]">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-sm z-30">
                <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex flex-col items-center gap-2">
                  <p className="animate-pulse text-[13px] font-bold text-indigo-400">{generationStatus}</p>
                  <p className="text-[10px] text-gray-500">{generationStatus.includes('Intent') ? 'Creative directive 정리 중...' : 'Fashion layers 적용 중...'}</p>
                </div>
              </div>
            ) : result ? (
              <>
                <img src={result.imageUrl} className="w-full h-full object-contain" alt="Generated Fashion Output" />
                {/* Hover Overlay Buttons */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-6 gap-3 z-20">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl transition-all active:scale-95 group/btn"
                    title="Enlarge View"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-3 bg-indigo-500 hover:bg-indigo-600 backdrop-blur-md border border-indigo-400/50 rounded-xl transition-all active:scale-95"
                    title="Download Image"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] font-medium text-gray-700">생성 결과가 여기에 표시됩니다</div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">5. Ai Generated Midjourney V7</h3>
              {result && !isPromptLoading && !mjPrompt && (
                <button
                  id="generate-prompt-btn"
                  onClick={handleGeneratePrompt}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-bold text-gray-300 transition-colors hover:border-indigo-500/30 hover:bg-white/[0.06]"
                >
                  프롬프트 생성하기
                </button>
              )}
            </div>
            <div className="relative rounded-xl border border-indigo-500/10 bg-[#020617] p-6">
              <div className="flex justify-end mb-4 h-9">
                {mjPrompt && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(fullMJ); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}
                    className="h-full w-[110px] rounded-lg bg-white text-[12px] font-bold text-black transition-all hover:bg-gray-200 active:scale-95"
                  >
                    {copySuccess ? "Copied!" : "Copy Prompt"}
                  </button>
                )}
              </div>
              <pre className="min-h-[60px] whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-gray-300">
                {isPromptLoading ? "Analyzing visual data..." : fullMJ || (result ? "Click generate button to create prompt." : "Awaiting results...")}
              </pre>
            </div>
          </div>
        </section>
        </div>
      </main>

      {/* Fullscreen Enlarge Modal */}
      {isModalOpen && result && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            <button
              className="absolute -top-12 right-0 md:-right-12 text-white/50 hover:text-white transition-colors"
              onClick={() => setIsModalOpen(false)}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={result.imageUrl}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              alt="Enlarged Fashion View"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-6 flex gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download HD PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
