type ApiErrorBody = {
  error?: string;
};

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({})) as ApiErrorBody;

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload as T;
}

export async function analyzeImage(base64Data: string, type: string): Promise<string> {
  const result = await requestJson<{ description: string }>('/api/analyze', {
    image: base64Data,
    type,
  });
  return result.description;
}

export async function generateMidjourneyPromptFromImage(imageUrl: string, mode = 'detailed'): Promise<{ positive: string }> {
  return requestJson<{ positive: string }>('/api/midjourney-prompt', {
    imageUrl,
    mode,
  });
}

export async function generateFashionMix(params: {
  faceImage?: string;
  faceDesc?: string;
  poseImage?: string;
  poseDesc?: string;
  clothingImages: { data: string; description: string; type: string }[];
  additionalPrompt: string;
  mergeMode?: string;
  creativePreset?: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  params.onStatusUpdate?.('References와 Clothing Items 분석 중...');

  const result = await requestJson<{ imageUrl: string }>('/api/generate', {
    faceImage: params.faceImage,
    faceDesc: params.faceDesc,
    poseImage: params.poseImage,
    poseDesc: params.poseDesc,
    clothingImages: params.clothingImages,
    additionalPrompt: params.additionalPrompt,
    mergeMode: params.mergeMode,
    creativePreset: params.creativePreset,
  });

  params.onStatusUpdate?.('2K 패션 에디토리얼 합성 완료');
  return result.imageUrl;
}
