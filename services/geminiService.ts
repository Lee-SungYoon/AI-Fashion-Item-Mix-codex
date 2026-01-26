
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

export async function analyzeImage(base64Data: string, type: string): Promise<string> {
  const ai = getAIClient();
  const mimeType = base64Data.split(';')[0].split(':')[1];
  const base64 = base64Data.split(',')[1];

  const prompt = `Act as an expert fashion archivist. Provide an ultra-detailed technical description of this ${type} reference. 
  Include: 
  - Material textures (e.g., grain of leather, weave of silk, knit of wool).
  - Exact color shades and patterns.
  - Structural fit and tailoring details.
  - Distinctive hardware or branding elements.
  If it's a face/person: describe the facial structure, skin tone, hair texture, and subtle expression.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] },
    config: { temperature: 0.1 }
  });

  return response.text || "No description.";
}

/**
 * Stage 1: Deep analysis of user intent and reference binding.
 */
async function synthesizeEditorialVision(params: {
  userPrompt: string;
  faceDesc?: string;
  poseDesc?: string;
  clothingItems: { description: string; type: string }[];
}): Promise<string> {
  const ai = getAIClient();
  
  const analysisPrompt = `
    Act as a World-Class Creative Director and Technical Prompt Engineer for High-End Fashion Editorial.
    Your mission is to synthesize a "Master Execution Plan" that binds multiple image references into a single cohesive vision.

    REFERENCE DNA:
    - FACE/IDENTITY: ${params.faceDesc || 'Maintain exact identity and expression from face reference.'}
    - POSE/STRUCTURE: ${params.poseDesc || 'Adopt the exact body posture and silhouette from pose reference.'}
    - GARMENTS: ${params.clothingItems.map(c => `[${c.type}: ${c.description}]`).join('; ')}
    
    PRIMARY CREATIVE DIRECTION (USER INTENT): "${params.userPrompt || 'Minimalist high-fashion studio editorial.'}"

    INSTRUCTIONS FOR VISION SYNTHESIS:
    1. ATMOSPHERE BINDING: Use the USER INTENT to define the environment, lighting (e.g., softbox, rim light, cinematic shadows), and camera specs (e.g., 85mm prime, f/1.8).
    2. CLOTHING INTEGRATION: Describe how the clothing items are layered and how they interact with the light (e.g., "The silk top catches the side lighting to emphasize its sheen").
    3. STRICT IDENTITY: Explicitly state that the model's face, hair, and pose must be a 1:1 reflection of the provided reference images.
    4. COLOR HARMONY: Ensure the palette is sophisticated and respects the original garment colors unless the user requested a specific color grading.
    
    Return ONLY the final synthesized technical directive. No conversational filler.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: analysisPrompt,
    config: { 
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  return response.text || params.userPrompt;
}

export async function generateMidjourneyPromptFromImage(imageUrl: string): Promise<{ positive: string, negative: string }> {
  const ai = getAIClient();
  const mimeType = imageUrl.split(';')[0].split(':')[1];
  const base64 = imageUrl.split(',')[1];

  const prompt = `Analyze this generated fashion image. Create a high-quality Midjourney V7 prompt that captures its essence. 
  Include specific photographic terms, lighting, and textures. 
  Return as JSON: {"positive": "...", "negative": "..."}.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] },
    config: { responseMimeType: "application/json", temperature: 0.7 }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return { positive: "High-end fashion editorial --ar 3:4 --v 7.0", negative: "distorted, low quality" };
  }
}

export async function generateFashionMix(params: {
  faceImage?: string;
  faceDesc?: string;
  poseImage?: string;
  poseDesc?: string;
  clothingImages: { data: string; description: string; type: string }[];
  additionalPrompt: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  const ai = getAIClient();
  
  // Step 1: Deep Vision Synthesis
  if (params.onStatusUpdate) params.onStatusUpdate("Synthesizing Style Intent...");
  const masterVision = await synthesizeEditorialVision({
    userPrompt: params.additionalPrompt,
    faceDesc: params.faceDesc,
    poseDesc: params.poseDesc,
    clothingItems: params.clothingImages.map(c => ({ description: c.description, type: c.type }))
  });

  // Step 2: High-Fidelity Generation (2.5 Pro Image for best quality & reference adherence)
  if (params.onStatusUpdate) params.onStatusUpdate("Generating 2K Editorial...");
  
  const parts: any[] = [
    { text: `
      URGENT SYSTEM DIRECTIVE: 
      Generate a 2K fashion editorial image using the attached visual references with ABSOLUTE FIDELITY.
      
      1. FACE IDENTITY: You MUST reconstruct the exact face, features, hair, and expression from the FACE REFERENCE image.
      2. POSE STRUCTURE: You MUST match the exact skeletal posture and body alignment of the POSE REFERENCE image.
      3. GARMENT RECONSTRUCTION: Every clothing item provided in the parts must be rendered with its original texture, pattern, and color.
      
      SCENE EXECUTION PLAN: ${masterVision}
      
      Do not hallucinate new clothing or change the person's identity. Combine all elements into a professional, high-end editorial shot.
    ` }
  ];

  // Add images in a logical order for the model
  if (params.faceImage) parts.push({ inlineData: { mimeType: 'image/png', data: params.faceImage.split(',')[1] } });
  if (params.poseImage) parts.push({ inlineData: { mimeType: 'image/png', data: params.poseImage.split(',')[1] } });
  
  params.clothingImages.forEach(img => {
    parts.push({ inlineData: { mimeType: 'image/png', data: img.data.split(',')[1] } });
  });

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: { 
      imageConfig: { 
        aspectRatio: "3:4", 
        imageSize: "2K" 
      } 
    }
  });

  if (!response.candidates?.[0]?.content?.parts) throw new Error("Synthesis aborted by safety or logic error.");

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error("Final generation failed to produce an image part.");
}
