
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

  const prompt = `Act as a world-class fashion analyst. Provide an ultra-detailed technical description of this ${type} reference. 
  
  If type is 'pose': Focus exclusively on the body's skeletal alignment, limb positioning, weight distribution, and the specific angle of the torso and shoulders.
  If type is 'face': Focus on facial geometry, eye shape, skin texture, specific hair styling, and the exact emotional micro-expression.
  If type is 'clothing': Focus on the material properties, weave, specific color values, hardware, and how the garment hangs.
  
  Be technical and precise.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] },
    config: { temperature: 0.1 }
  });

  return response.text || "No description.";
}

/**
 * Stage 1: Strategic Synthesis of Vision
 */
async function synthesizeEditorialVision(params: {
  userPrompt: string;
  faceDesc?: string;
  poseDesc?: string;
  clothingItems: { description: string; type: string }[];
}): Promise<string> {
  const ai = getAIClient();
  
  const analysisPrompt = `
    Act as a Master Fashion Creative Director. You are preparing a technical brief for a high-end 2K image synthesis engine.
    Your goal is to perfectly blend identity, posture, and wardrobe into a single cinematic shot.

    INPUT DATA:
    1. TARGET IDENTITY (Face/Hair): ${params.faceDesc || 'Maintain exact features and expression from Face Reference.'}
    2. TARGET STRUCTURE (Pose/Stance): ${params.poseDesc || 'Adopt the exact body geometry and skeletal pose from Pose Reference.'}
    3. TARGET WARDROBE (Items): ${params.clothingItems.map(c => `[${c.type}: ${c.description}]`).join('; ')}
    4. ARTISTIC CONTEXT (User Intent): "${params.userPrompt || 'Professional high-fashion studio editorial.'}"

    INSTRUCTIONS FOR THE BRIEF:
    - DECOUPLE & RECOMBINE: Explicitly instruct the engine to take ONLY the body pose from the Pose Reference and ONLY the facial identity from the Face Reference.
    - MATERIAL FIDELITY: Describe how the specific clothing items interact with the body's stance (e.g., "The fabric of the ${params.clothingItems[0]?.type || 'garment'} should drape realistically according to the weight distribution of the pose").
    - CINEMATIC LIGHTING: Based on the User Intent, define a lighting scheme (e.g., "Dramatic chiaroscuro", "High-key studio", "Golden hour rim lighting") that emphasizes the textures of the clothes and the contours of the pose.
    - BACKGROUND & MOOD: Fully realize the environment requested in the User Intent.

    Return ONLY the final consolidated technical prompt for image generation.
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

  const prompt = `Analyze this generated fashion image. Create a high-quality Midjourney V7 prompt for it. 
  Include photographic details, lighting, and textures. 
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
  
  if (params.onStatusUpdate) params.onStatusUpdate("Deconstructing References...");
  const masterVision = await synthesizeEditorialVision({
    userPrompt: params.additionalPrompt,
    faceDesc: params.faceDesc,
    poseDesc: params.poseDesc,
    clothingItems: params.clothingImages.map(c => ({ description: c.description, type: c.type }))
  });

  if (params.onStatusUpdate) params.onStatusUpdate("Synthesizing 2K Masterpiece...");
  
  const parts: any[] = [
    { text: `
      STRICT ARCHITECTURAL DIRECTIVE: 
      You are generating a 2K resolution professional fashion editorial. 
      You must follow these rules with absolute precision:

      1. POSE ISOLATION: Analyze the 'Pose Reference' image. Extract the EXACT body skeletal structure, arm/leg positions, and torso angle. Apply this pose to the final model.
      2. IDENTITY TRANSFER: Analyze the 'Face Reference' image. Reconstruct the EXACT facial features, skin tone, hair style, and expression onto the model.
      3. CLOTHING RECONSTRUCTION: Render the attached 'Clothing' images onto the model. Maintain the original colors, patterns, and fabric textures described.
      4. SCENE EXECUTION: ${masterVision}

      The final output must look like a real, high-end photograph. Zero compromise on pose and face fidelity.
    ` }
  ];

  // Provide references with clear labels for the model
  if (params.faceImage) {
    parts.push({ text: "IDENTITY REFERENCE (Face/Hair):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: params.faceImage.split(',')[1] } });
  }
  if (params.poseImage) {
    parts.push({ text: "BODY STRUCTURE REFERENCE (Pose/Stance):" });
    parts.push({ inlineData: { mimeType: 'image/png', data: params.poseImage.split(',')[1] } });
  }
  
  params.clothingImages.forEach((img, index) => {
    parts.push({ text: `CLOTHING ITEM ${index + 1} (${img.type}):` });
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

  if (!response.candidates?.[0]?.content?.parts) throw new Error("Generation failed - logic conflict or safety block.");

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error("No image data returned from synthesis engine.");
}
