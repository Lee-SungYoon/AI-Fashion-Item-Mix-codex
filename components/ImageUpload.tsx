
import React, { useState } from 'react';
import { ImageSlotType } from '../types';

interface ImageUploadProps {
  id: ImageSlotType;
  label: string;
  data: string | null;
  description: string;
  isProcessing: boolean;
  onUpload: (id: ImageSlotType, file: File) => void;
  onDelete: (id: ImageSlotType) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ id, label, data, description, isProcessing, onUpload, onDelete }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(id, file);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-[11px] font-bold text-[#ffffff] uppercase tracking-normal opacity-80">{label}</span>
      <div
        className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border border-dashed transition-all overflow-hidden ${isDragging ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]' : data ? 'border-indigo-500 bg-zinc-950' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) onUpload(id, file); }}
      >
        <label className="absolute inset-0 cursor-pointer">
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
        {data ? (
          <>
            <img src={data} alt={label} className="w-full h-full object-contain pointer-events-none" />
            <button
              id={`delete-${id}-btn`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(id); }}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg border border-white/10 z-10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center text-center p-10 opacity-40">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" /></svg>
            <p className="text-[10px] font-bold uppercase tracking-widest">Upload</p>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm z-20">
            <div className="w-5 h-5 border border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {description && !isProcessing && <div className="text-[9px] text-zinc-600 line-clamp-1 italic px-1">{description}</div>}
    </div>
  );
};

export default ImageUpload;
