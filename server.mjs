import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');
const PORT = Number(process.env.PORT || 3004);
const MAX_JSON_BYTES = 170 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PROMPT_CHARS = 2000;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_SLOT_TYPES = new Set(['face', 'pose', 'outer', 'top', 'bottom', 'shoes', 'accessory', 'accessory2']);
const CREATIVE_PRESET_GUIDES = {
  editorial: 'Professional high-fashion studio editorial, controlled lighting, refined magazine composition.',
  lookbook: 'Clean premium lookbook, full outfit readability, accurate garment colors and construction details.',
  campaign: 'Luxury campaign image, polished commercial styling, aspirational mood, elevated product focus.',
  street: 'Street editorial, natural attitude, urban fashion context, stylish but realistic environment.',
};
const MERGE_MODE_GUIDES = {
  balanced: 'Balance facial identity fidelity and pose fidelity equally.',
  face: 'Prioritize exact facial identity and hair fidelity while still preserving the pose.',
  pose: 'Prioritize exact body pose, stance, and camera angle while preserving the face as much as possible.',
};
const MIDJOURNEY_MODE_GUIDES = {
  detailed: 'Write a detailed visual prompt with rich image-specific details.',
  short: 'Write a concise prompt, one compact paragraph, with only the strongest visual cues.',
  lookbook: 'Write a clean fashion lookbook prompt focused on outfit readability and styling.',
  campaign: 'Write a premium advertising campaign prompt focused on luxury mood and commercial polish.',
};
loadEnvFile('.env.local');
loadEnvFile('.env');

const DEFAULT_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const apiLimits = new Map();

function loadEnvFile(name) {
  const file = path.join(__dirname, name);
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function securityHeaders(extra = {}) {
  const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'";
  return {
    'Content-Security-Policy': `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; ${scriptSrc}; connect-src 'self' ws: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }));
  res.end(payload);
}

function sanitizeError(error) {
  const message = String(error?.message || error || '');
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) return 'RESOURCE_EXHAUSTED';
  if (message.includes('SAFETY')) return 'SAFETY';
  if (message.includes('Invalid image') || message.includes('Image is too large')) return 'Invalid image input.';
  if (message.includes('Payload too large')) return 'Payload too large.';
  if (message.includes('Invalid slot')) return 'Invalid image slot.';
  if (message.includes('API key')) return 'API key is missing or invalid.';
  return 'Request failed. Please try again.';
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(req, bucket, max, windowMs) {
  const now = Date.now();
  const key = `${clientIp(req)}:${bucket}`;
  const entry = apiLimits.get(key);
  if (!entry || entry.expiresAt <= now) {
    apiLimits.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

function isPrivateHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function verifyOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = String(req.headers.host || '').split(':')[0];
    return parsed.protocol === 'http:' && isPrivateHostname(parsed.hostname) && (parsed.hostname === host || isPrivateHostname(host));
  } catch {
    return false;
  }
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    throw new Error('Unsupported content type.');
  }
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) throw new Error('Payload too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('API key is missing.');
  return new GoogleGenAI({ apiKey });
}

function validateText(value, max = MAX_PROMPT_CHARS) {
  return String(value || '').replace(/\u0000/g, '').slice(0, max);
}

function getImagePart(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('Invalid image.');
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1])) throw new Error('Invalid image type.');
  const byteLength = Math.floor((match[2].length * 3) / 4);
  if (byteLength <= 0 || byteLength > MAX_IMAGE_BYTES) throw new Error('Image is too large.');
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

async function withRetry(fn, retries = 3, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    const errorMsg = String(error?.message || '');
    if (retries > 0 && (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED'))) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

async function analyzeImage(base64Data, type) {
  if (!IMAGE_SLOT_TYPES.has(type)) throw new Error('Invalid slot type.');
  const imagePart = getImagePart(base64Data);
  const ai = getAIClient();

  const prompt = `Act as a world-class fashion analyst. Provide an ultra-detailed technical description of this ${type} reference.

  If type is 'pose': Focus exclusively on the body's skeletal alignment, limb positioning, weight distribution, and the specific angle of the torso and shoulders.
  If type is 'face': Focus on facial geometry, eye shape, skin texture, specific hair styling, and the exact emotional micro-expression.
  If type is 'clothing': Focus on the material properties, weave, specific color values, hardware, and how the garment hangs.

  Be technical and precise.`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: { temperature: 0.1, safetySettings: DEFAULT_SAFETY_SETTINGS },
    });
    return response.text || 'No description.';
  });
}

async function synthesizeEditorialVision(params) {
  const ai = getAIClient();
  const clothingItems = params.clothingItems.slice(0, 6);
  const presetGuide = CREATIVE_PRESET_GUIDES[params.creativePreset] || CREATIVE_PRESET_GUIDES.editorial;
  const mergeGuide = MERGE_MODE_GUIDES[params.mergeMode] || MERGE_MODE_GUIDES.balanced;
  const analysisPrompt = `
    Act as a Master Fashion Creative Director. You are preparing a technical brief for a high-end 2K image synthesis engine.
    Your goal is to perfectly blend identity, posture, and wardrobe into a single cinematic shot.

    INPUT DATA:
    1. TARGET IDENTITY (Face/Hair): ${validateText(params.faceDesc, 4000) || 'Maintain exact features and expression from Face Reference.'}
    2. TARGET STRUCTURE (Pose/Stance): ${validateText(params.poseDesc, 4000) || 'Adopt the exact body geometry and skeletal pose from Pose Reference.'}
    3. TARGET WARDROBE (Items): ${clothingItems.map((c) => `[${validateText(c.type, 40)}: ${validateText(c.description, 4000)}]`).join('; ')}
    4. ARTISTIC CONTEXT (User Intent): "${validateText(params.userPrompt)}"
    5. STYLE PRESET: ${presetGuide}
    6. MERGE PRIORITY: ${mergeGuide}

    INSTRUCTIONS FOR THE BRIEF:
    - DECOUPLE & RECOMBINE: Explicitly instruct the engine to take ONLY the body pose from the Pose Reference and ONLY the facial identity from the Face Reference.
    - MATERIAL FIDELITY: Describe how the specific clothing items interact with the body's stance and preserve original colors, texture, shape, hardware, and visible details.
    - CINEMATIC LIGHTING: Define a lighting scheme that emphasizes the textures of the clothes and the contours of the pose.
    - BACKGROUND & MOOD: Fully realize the environment requested in the User Intent.

    Return ONLY the final consolidated technical prompt for image generation.
  `;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: analysisPrompt,
      config: { temperature: 0.7, safetySettings: DEFAULT_SAFETY_SETTINGS },
    });
    return response.text || validateText(params.userPrompt);
  });
}

async function generateFashionMix(params) {
  const clothingImages = Array.isArray(params.clothingImages) ? params.clothingImages.slice(0, 6) : [];
  const mergeGuide = MERGE_MODE_GUIDES[params.mergeMode] || MERGE_MODE_GUIDES.balanced;
  const presetGuide = CREATIVE_PRESET_GUIDES[params.creativePreset] || CREATIVE_PRESET_GUIDES.editorial;
  const faceImagePart = params.faceImage ? getImagePart(params.faceImage) : null;
  const poseImagePart = params.poseImage ? getImagePart(params.poseImage) : null;
  const clothingImageParts = clothingImages.map((img) => getImagePart(img.data));
  const ai = getAIClient();
  const masterVision = await synthesizeEditorialVision({
    userPrompt: params.additionalPrompt,
    faceDesc: params.faceDesc,
    poseDesc: params.poseDesc,
    mergeMode: params.mergeMode,
    creativePreset: params.creativePreset,
    clothingItems: clothingImages.map((c) => ({ description: c.description, type: c.type })),
  });

  const parts = [
    { text: `
      STRICT ARCHITECTURAL DIRECTIVE:
      You are generating a 2K resolution professional fashion editorial.
      You must follow these rules with absolute precision:

      1. REFERENCES CONSISTENCY: Treat the References pair as one merged identity-and-pose source.
         - Use the IDENTITY REFERENCE only for face, hair, skin tone, expression, and recognizable facial structure.
         - Use the BODY STRUCTURE REFERENCE only for pose, body alignment, camera angle, stance, lighting direction, and mood.
         - Do not invent a new face or a new pose when these references are present.
         - Merge priority: ${mergeGuide}

      2. CLOTHING ITEM FIDELITY: Analyze every Clothing Items image precisely.
         - Preserve original garment silhouettes, colors, materials, textures, seams, hardware, logos if visible, and layering order.
         - Fit the uploaded items naturally onto the merged References subject without replacing the face or pose.

      3. FINAL MERGE: Combine References and Clothing Items into one coherent fashion editorial image.
         - The model must look like the References identity in the References pose while wearing the uploaded Clothing Items.

      4. SCENE EXECUTION: ${masterVision}
      5. STYLE PRESET EXECUTION: ${presetGuide}

      The final output must be photorealistic, high-end, and indistinguishable from a real fashion magazine shoot.
    ` },
  ];

  if (params.faceImage) {
    parts.push({ text: 'IDENTITY REFERENCE (Face/Hair):' });
    parts.push(faceImagePart);
  }
  if (params.poseImage) {
    parts.push({ text: 'BODY STRUCTURE REFERENCE (Pose/Stance):' });
    parts.push(poseImagePart);
  }

  clothingImages.forEach((img, index) => {
    parts.push({ text: `CLOTHING ITEM ${index + 1} (${validateText(img.type, 40)}):` });
    parts.push(clothingImageParts[index]);
  });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: { imageConfig: { aspectRatio: '3:4', imageSize: '2K' } },
    });
    const responseParts = response.candidates?.[0]?.content?.parts;
    if (!responseParts) throw new Error('Generation failed - logic conflict or safety block.');
    for (const part of responseParts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error('No image data returned from synthesis engine.');
  });
}

async function generateMidjourneyPromptFromImage(imageUrl, mode = 'detailed') {
  const imagePart = getImagePart(imageUrl);
  const ai = getAIClient();
  const modeGuide = MIDJOURNEY_MODE_GUIDES[mode] || MIDJOURNEY_MODE_GUIDES.detailed;
  const prompt = `Analyze the attached Section 4 generated result image with maximum visual fidelity.

  Create one Midjourney-ready positive prompt that would recreate an image as close as possible to this exact result.
  Output mode: ${modeGuide}

  Requirements:
  - Describe the subject identity, face, hairstyle, expression, pose, body angle, wardrobe, accessories, fabric textures, colors, layering, lighting, background, camera angle, lens feel, composition, editorial styling, and mood visible in the image.
  - Prioritize concrete visual evidence from the image over generic fashion words.
  - Preserve the 3:4 fashion editorial composition.
  - Do not add Midjourney version parameters or version-related parameters.
  - Do not include a negative prompt.
  - Do not include --no.
  - Do not mention that this is an uploaded image, generated image, reference image, or analysis.

  Return only valid JSON with this exact shape:
  {"positive":"..."}`;

  const result = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: { responseMimeType: 'application/json', temperature: 0.7, safetySettings: DEFAULT_SAFETY_SETTINGS },
    });
    return response.text;
  });

  try {
    const parsed = JSON.parse(result || '{}');
    return {
      positive: stripMidjourneyParams(validateText(parsed.positive, 4000) || 'High-end fashion editorial, photorealistic model, detailed wardrobe, studio lighting'),
    };
  } catch {
    return {
      positive: stripMidjourneyParams('High-end fashion editorial, photorealistic model, detailed wardrobe, precise pose, cinematic lighting'),
    };
  }
}

async function generateKlingPromptFromImage(imageUrl) {
  const imagePart = getImagePart(imageUrl);
  const ai = getAIClient();
  const prompt = `Analyze the attached Section 4 generated fashion editorial image with maximum visual fidelity.

  Create one Kling Omni image-to-video prompt for animating this exact still image.

  Context and intent:
  - The image is usually a fashion editorial, lookbook, or campaign result.
  - The output should feel like a premium slow-motion fashion film, not a dramatic action scene.
  - The reference image already defines the face, body, outfit, styling, lighting, and composition. Use the prompt mainly to direct motion, camera behavior, timing, and physical continuity.

  Requirements:
  - Preserve the model identity, facial structure, outfit, colors, garment shape, accessories, pose, scene, lighting, and 3:4 editorial composition from the image.
  - Add natural subtle movement only: gentle breathing, slight head turn, soft blink, tiny expression change, minor hand or shoulder adjustment, fabric settling, hair movement, or a small weight shift when plausible.
  - Add a controlled camera move suitable for Kling Omni: slow push-in, slight dolly, gentle handheld drift, or subtle parallax.
  - Describe one continuous shot with no cuts or scene transitions.
  - Keep the motion physically plausible and slow. Avoid dancing, running, jumping, rapid pose changes, face morphing, outfit changes, object warping, extra limbs, or camera shake.
  - Write as a positive prompt only. Do not include a negative prompt, version parameters, markdown, labels, or explanations.
  - Include short timing beats if helpful, for example "0-2s..." and "2-5s...".
  - Do not mention that this is an uploaded image, generated image, reference image, or analysis.

  Return only valid JSON with this exact shape:
  {"prompt":"..."}`;

  const result = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: { responseMimeType: 'application/json', temperature: 0.55, safetySettings: DEFAULT_SAFETY_SETTINGS },
    });
    return response.text;
  });

  try {
    const parsed = JSON.parse(result || '{}');
    return {
      prompt: stripKlingPrompt(validateText(parsed.prompt, 4000) || 'One continuous slow-motion fashion editorial shot, the model holds the original pose with a soft blink and gentle breathing, fabric and hair move subtly, slow camera push-in, natural studio lighting, premium cinematic look.'),
    };
  } catch {
    return {
      prompt: stripKlingPrompt('One continuous slow-motion fashion editorial shot, the model holds the original pose with a soft blink and gentle breathing, fabric and hair move subtly, slow camera push-in, natural studio lighting, premium cinematic look.'),
    };
  }
}

function stripMidjourneyParams(prompt) {
  return prompt
    .replace(/\s--style\s+raw\b/g, '')
    .replace(/\s--v\s+\S+/g, '')
    .replace(/\s--ar\s+\S+/g, '')
    .replace(/\s--hd\b/g, '')
    .replace(/\s--raw\b/g, '')
    .replace(/\s--q\s+\S+/g, '')
    .replace(/\s--no\b.*$/g, '')
    .trim();
}

function stripKlingPrompt(prompt) {
  return prompt
    .replace(/^\s*(negative prompt|negative|avoid)\s*:\s*.*$/gim, '')
    .replace(/\s--no\b.*$/g, '')
    .replace(/\s--v\s+\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function handleApi(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
  if (!verifyOrigin(req)) return sendJson(res, 403, { error: 'Invalid request origin.' });

  try {
    if (req.url === '/api/analyze') {
      if (!checkRateLimit(req, 'analyze', 30, 60_000)) return sendJson(res, 429, { error: 'Too many analysis requests.' });
      const body = await readJson(req);
      const description = await analyzeImage(body.image, body.type);
      return sendJson(res, 200, { description });
    }

    if (req.url === '/api/generate') {
      if (!checkRateLimit(req, 'generate', 8, 10 * 60_000)) return sendJson(res, 429, { error: 'Too many generation requests.' });
      const body = await readJson(req);
      const imageUrl = await generateFashionMix(body);
      return sendJson(res, 200, { imageUrl });
    }

    if (req.url === '/api/midjourney-prompt') {
      if (!checkRateLimit(req, 'prompt', 20, 60_000)) return sendJson(res, 429, { error: 'Too many prompt requests.' });
      const body = await readJson(req);
      const prompt = await generateMidjourneyPromptFromImage(body.imageUrl, body.mode);
      return sendJson(res, 200, prompt);
    }

    if (req.url === '/api/kling-prompt') {
      if (!checkRateLimit(req, 'kling-prompt', 20, 60_000)) return sendJson(res, 429, { error: 'Too many prompt requests.' });
      const body = await readJson(req);
      const prompt = await generateKlingPromptFromImage(body.imageUrl);
      return sendJson(res, 200, prompt);
    }

    return sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    return sendJson(res, 400, { error: sanitizeError(error) });
  }
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function serveStatic(req, res) {
  const dist = path.join(__dirname, 'dist');
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const safePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const candidate = path.normalize(path.join(dist, safePath || 'index.html'));
  if (!candidate.startsWith(dist) || path.basename(candidate).startsWith('.')) {
    res.writeHead(403, securityHeaders());
    return res.end('Forbidden');
  }
  const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(dist, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, securityHeaders());
    return res.end('Build output not found. Run npm run build first.');
  }
  res.writeHead(200, securityHeaders({
    'Content-Type': contentType(file),
    'Cache-Control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
  }));
  fs.createReadStream(file).pipe(res);
}

async function start() {
  let vite;
  if (isDev) {
    const { createServer } = await import('vite');
    vite = await createServer({
      server: { middlewareMode: true, hmr: { port: 24680 } },
      appType: 'spa',
    });
  }

  const server = http.createServer(async (req, res) => {
    if (req.url?.startsWith('/api/')) return handleApi(req, res);
    if (vite) {
      for (const [key, value] of Object.entries(securityHeaders())) res.setHeader(key, value);
      return vite.middlewares(req, res);
    }
    return serveStatic(req, res);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Fashion / Item Mix server listening on http://localhost:${PORT}/`);
  });
}

start().catch((error) => {
  console.error(sanitizeError(error));
  process.exit(1);
});
