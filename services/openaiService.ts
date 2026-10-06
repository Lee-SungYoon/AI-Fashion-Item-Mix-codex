type ClothingImage = { data: string; description: string; type: string };

async function callApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function analyzeImage(base64Data: string, type: string): Promise<string> {
  return callApi<string>('/api/analyze-image', { imageDataUrl: base64Data, type });
}

export async function generateMidjourneyPromptFromImage(
  imageUrl: string,
): Promise<{ positive: string; negative: string }> {
  return callApi<{ positive: string; negative: string }>('/api/midjourney-prompt', { imageDataUrl: imageUrl });
}

export async function generateFashionMix(params: {
  faceImage?: string;
  faceDesc?: string;
  poseImage?: string;
  poseDesc?: string;
  clothingImages: ClothingImage[];
  additionalPrompt: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  params.onStatusUpdate?.('Deconstructing References...');
  const result = await callApi<{ imageDataUrl: string }>('/api/generate-fashion-mix', {
    faceImage: params.faceImage,
    faceDesc: params.faceDesc,
    poseImage: params.poseImage,
    poseDesc: params.poseDesc,
    clothingImages: params.clothingImages,
    additionalPrompt: params.additionalPrompt,
  });
  params.onStatusUpdate?.('Synthesizing Editorial Image...');
  return result.imageDataUrl;
}
