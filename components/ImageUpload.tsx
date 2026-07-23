
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
    <div className="flex w-full flex-col gap-2">
      <span className="text-xs font-bold text-gray-300">{label}</span>
      <div
        className={`group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${isDragging ? 'scale-[1.02] border-indigo-400 bg-indigo-500/10' : data ? 'border-indigo-500/50 bg-[#050505]' : 'border-white/10 bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.04]'}`}
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
              className="absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-black/70 p-1.5 text-white transition-colors hover:bg-red-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 transition-all group-hover:scale-110 group-hover:bg-indigo-600/20">
              <svg className="h-7 w-7 text-gray-400 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300">이미지 업로드</p>
              <p className="mt-1 text-[10px] text-gray-500">PNG, JPG, WEBP</p>
            </div>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-5 h-5 border border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {description && !isProcessing && <div className="line-clamp-1 px-1 text-[10px] text-indigo-400/80">{description}</div>}
    </div>
  );
};

export default ImageUpload;
