import { createServer } from 'node:http';
import { loadEnv, createServer as createViteServer } from 'vite';

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const env = loadEnv('development', root, '');
const openAiApiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
const TEXT_MODEL = 'gpt-5.6-luna';
const IMAGE_MODEL = 'gpt-image-2.5-flare';
const MAX_BODY_BYTES = 80 * 1024 * 1024;

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function assertDataUrl(value, label) {
  if (typeof value !== 'string' || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value)) {
    throw new Error(`${label} must be a base64 image data URL.`);
  }
}

async function openAiRequest(path, body) {
  if (!openAiApiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function responseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  return (payload?.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

async function runTextModel(input) {
  const payload = await openAiRequest('/responses', {
    model: TEXT_MODEL,
    reasoning: { effort: 'low' },
    input,
  });
  const text = responseText(payload);
  if (!text) throw new Error('OpenAI returned no text output.');
  return text;
}

function imageInput(imageDataUrl, detail = 'high') {
  return { type: 'input_image', image_url: imageDataUrl, detail };
}

async function analyzeImage({ imageDataUrl, type }) {
  assertDataUrl(imageDataUrl, 'imageDataUrl');
  const prompt = `Act as a world-class fashion analyst. Provide an ultra-detailed technical description of this ${type} reference.

If type is 'pose': focus exclusively on skeletal alignment, limb positioning, weight distribution, torso angle, and camera composition.
If type is 'face': focus on facial geometry, eye shape, skin texture, hair styling, and emotional micro-expression.
If type is 'clothing': focus on material properties, weave, color, hardware, fit, and how the garment hangs.

Be precise, factual, and useful to a downstream fashion image editor.`;
  return runTextModel([{ role: 'user', content: [{ type: 'input_text', text: prompt }, imageInput(imageDataUrl)] }]);
}

async function synthesizeEditorialVision({ userPrompt, faceDesc, poseDesc, clothingItems }) {
  const prompt = `Act as a master fashion creative director. Produce a consolidated technical brief for a high-end fashion image editor.

TARGET IDENTITY: ${faceDesc || 'Preserve the exact face and hair from the identity reference.'}
TARGET POSE: ${poseDesc || 'Use the exact body geometry and stance from the pose reference.'}
TARGET WARDROBE: ${clothingItems.map((item) => `[${item.type}: ${item.description}]`).join('; ')}
ARTISTIC CONTEXT: ${userPrompt || 'Professional high-fashion studio editorial.'}

Explicitly separate face identity, pose geometry, wardrobe material fidelity, lighting, background, and mood. Return only the final technical image prompt.`;
  return runTextModel([{ role: 'user', content: [{ type: 'input_text', text: prompt }] }]);
}

async function midjourneyPrompt({ imageDataUrl }) {
  assertDataUrl(imageDataUrl, 'imageDataUrl');
  const prompt = `Analyze this generated fashion image and return ONLY valid JSON in this exact shape:
{"positive":"high-quality Midjourney V7 prompt with photography, lighting, composition, and texture details","negative":"comma-separated negative prompt"}`;
  const text = await runTextModel([{ role: 'user', content: [{ type: 'input_text', text: prompt }, imageInput(imageDataUrl)] }]);
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
    return { positive: String(parsed.positive || ''), negative: String(parsed.negative || '') };
  } catch {
    return { positive: 'High-end fashion editorial --ar 3:4 --v 7.0', negative: 'distorted, low quality' };
  }
}

async function generateFashionMix(params) {
  const references = [];
  if (params.faceImage) { assertDataUrl(params.faceImage, 'faceImage'); references.push({ image_url: params.faceImage }); }
  if (params.poseImage) { assertDataUrl(params.poseImage, 'poseImage'); references.push({ image_url: params.poseImage }); }
  for (const item of params.clothingImages || []) {
    assertDataUrl(item.data, 'clothing image');
    references.push({ image_url: item.data });
  }
  if (!references.length) throw new Error('At least one reference image is required.');

  const masterVision = await synthesizeEditorialVision({
    userPrompt: params.additionalPrompt,
    faceDesc: params.faceDesc,
    poseDesc: params.poseDesc,
    clothingItems: (params.clothingImages || []).map((item) => ({ description: item.description, type: item.type })),
  });

  const prompt = `Create a photorealistic high-fashion editorial image in portrait format.
Use the supplied references as follows: preserve the face/hair identity from the identity reference, preserve the skeletal pose and camera geometry from the pose reference, and reconstruct every clothing item with accurate color, texture, fit, layering, and branding.

Editorial direction:
${masterVision}

Additional direction: ${params.additionalPrompt || 'premium studio fashion lighting'}`;

  const payload = await openAiRequest('/images/edits', {
    model: IMAGE_MODEL,
    images: references,
    prompt,
    size: '1024x1536',
    quality: 'medium',
    output_format: 'png',
  });
  const image = payload?.data?.[0]?.b64_json;
  if (!image) throw new Error('OpenAI returned no image data.');
  return { imageDataUrl: `data:image/png;base64,${image}` };
}

async function handleApi(req, res) {
  if (req.method === 'GET' && req.url === '/api/health') {
    return json(res, 200, { ok: Boolean(openAiApiKey), provider: 'openai', textModel: TEXT_MODEL, imageModel: IMAGE_MODEL });
  }
  if (req.method !== 'POST') return json(res, 405, { error: { message: 'Method not allowed.' } });
  try {
    const body = await readJson(req);
    let result;
    if (req.url === '/api/analyze-image') result = await analyzeImage(body);
    else if (req.url === '/api/midjourney-prompt') result = await midjourneyPrompt(body);
    else if (req.url === '/api/generate-fashion-mix') result = await generateFashionMix(body);
    else return json(res, 404, { error: { message: 'API route not found.' } });
    return json(res, 200, result);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 400;
    return json(res, status, { error: { message: error.message || 'Request failed.' } });
  }
}

const vite = await createViteServer({
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
});

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return handleApi(req, res);
  return vite.middlewares(req, res, () => {
    res.statusCode = 404;
    res.end('Not found');
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AI Fashion server listening on http://127.0.0.1:${port}`);
});

const shutdown = async () => {
  server.close();
  await vite.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
