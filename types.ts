
export type ImageSlotType = 'face' | 'pose' | 'outer' | 'top' | 'bottom' | 'shoes' | 'accessory';

export interface ImageSlot {
  id: ImageSlotType;
  label: string;
  data: string | null;
  description: string;
  isProcessing: boolean;
}

export interface GenerationResult {
  imageUrl: string;
  aspectRatio: string;
}
