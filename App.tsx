
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

  const handleUpload = async (id: ImageSlotType, file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      const setter = ['face', 'pose'].includes(id) ? setSlots : setClothing;
      setter(prev => prev.map(s => s.id === id ? { ...s, data: base64, isProcessing: true } : s));
      const description = await analyzeImage(base64, id);
      setter(prev => prev.map(s => s.id === id ? { ...s, description, isProcessing: false } : s));
    };
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

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="p-8 border-b border-zinc-900 text-center">
        <div className="flex items-center justify-center gap-4">
          <h1 className="text-[36px] font-bold tracking-tight">AI Fashion / Detailed Mix</h1>
          <div className="bg-[#5456f3] px-3 py-1 rounded-lg flex items-center justify-center">
            <span className="text-white text-[12px] font-black uppercase tracking-normal">PRO</span>
          </div>
        </div>
        <p className="text-zinc-600 text-[11px] uppercase tracking-widest mt-2">Studio Editorial Synthesis Engine</p>
      </header>

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Panel */}
        <section className="p-10 border-r border-zinc-900 space-y-12">
          <div className="space-y-6">
            <h2 className="text-[14px] font-black uppercase">References</h2>
            <div className="grid grid-cols-2 gap-6">{slots.map(s => <ImageUpload key={s.id} {...s} onUpload={handleUpload} onDelete={(id) => setSlots(p => p.map(x => x.id === id ? {...x, data: null} : x))} />)}</div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-[14px] font-black uppercase">Clothing Items</h2>
            <div className="grid grid-cols-3 gap-4">{clothing.map(c => <ImageUpload key={c.id} {...c} onUpload={handleUpload} onDelete={(id) => setClothing(p => p.map(x => x.id === id ? {...x, data: null} : x))} />)}</div>
          </div>

          <div className="space-y-6">
            <h2 className="text-[14px] font-black uppercase tracking-tight">Prompt 추가</h2>
            <textarea
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="배경, 조명, 분위기 또는 특정 디테일을 입력하세요 (예: 80s Cyberpunk, Studio Soft Lighting, Vogue Style...)"
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-[13px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
            />
          </div>

          <button onClick={handleGenerate} className="w-full py-6 bg-[#19ad55] rounded-2xl font-black text-[16px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100" disabled={isGenerating}>
            {isGenerating ? "ANALYZING INTENT..." : "Generate Image(2K)"}
          </button>
        </section>

        {/* Right Panel */}
        <section className="p-10 space-y-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-black uppercase">Studio Output</h2>
            {result && (
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[12px] font-bold transition-all active:scale-95 group"
              >
                <svg className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download PNG</span>
              </button>
            )}
          </div>
          
          <div className="aspect-[3/4] bg-zinc-950 rounded-3xl border border-zinc-900 overflow-hidden relative group">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-sm z-30">
                <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[14px] font-black uppercase tracking-[0.2em] animate-pulse text-indigo-400">{generationStatus}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{generationStatus.includes('Intent') ? 'Refining creative directive...' : 'Applying neural fashion layers...'}</p>
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
              <div className="h-full flex items-center justify-center opacity-10 font-bold uppercase tracking-[0.3em] text-[10px]">Awaiting Signal</div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-black">Ai Generated Midjourney V7</h3>
              {result && !isPromptLoading && !mjPrompt && (
                <button 
                  onClick={handleGeneratePrompt}
                  className="bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold py-2 px-4 rounded-lg border border-zinc-700 transition-colors"
                >
                  프롬프트 생성하기
                </button>
              )}
            </div>
            <div className="bg-[#020617] border border-zinc-900 rounded-xl p-6 relative">
              <div className="flex justify-end mb-4 h-9">
                {mjPrompt && (
                  <button 
                    onClick={() => { navigator.clipboard.writeText(fullMJ); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}
                    className="w-[110px] h-full bg-[#19ad55] rounded-lg text-[12px] font-bold transition-all active:scale-95"
                  >
                    {copySuccess ? "Copied!" : "Copy Prompt"}
                  </button>
                )}
              </div>
              <pre className="text-[12px] text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed min-h-[60px]">
                {isPromptLoading ? "Analyzing visual data..." : fullMJ || (result ? "Click generate button to create prompt." : "Awaiting results...")}
              </pre>
            </div>
          </div>
        </section>
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
