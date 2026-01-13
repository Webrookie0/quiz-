import { GoogleGenerativeAI } from '@google/generative-ai';

// IMPORTANT:
// Do NOT read process.env at module load time because `dotenv.config()` is called
// in `server.ts` after imports. Instead, read env lazily when the function runs.
let genAI: GoogleGenerativeAI | null = null;
let selectedModelId: string | null = null;
let discoveredModelIds: string[] | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (genAI) return genAI;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY in environment');
  }

  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

function normalizeModelId(modelName: string): string {
  // API may return names like `models/gemini-1.5-pro-latest`
  return modelName.startsWith('models/') ? modelName.slice('models/'.length) : modelName;
}

async function getModelId(client: GoogleGenerativeAI): Promise<string> {
  // Kept for backwards-compat: returns a best guess, but we only *cache* a model
  // once it successfully generates content.
  const modelIds = await getCandidateModelIds(client);
  return modelIds[0] || 'gemini-2.5-flash';
}

async function discoverGenerateContentModels(apiKey: string): Promise<string[]> {
  if (discoveredModelIds) return discoveredModelIds;

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`ListModels failed: ${resp.status} ${resp.statusText}`);
  }
  const data: any = await resp.json();
  const models: any[] = Array.isArray(data?.models) ? data.models : [];
  const usable = models.filter((m) => Array.isArray(m?.supportedGenerationMethods)
    && m.supportedGenerationMethods.includes('generateContent')
    && typeof m?.name === 'string');

  discoveredModelIds = usable.map((m) => normalizeModelId(m.name));
  return discoveredModelIds;
}

function uniqPreserveOrder(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function getCandidateModelIds(_client: GoogleGenerativeAI): Promise<string[]> {
  // Prefer models that are typically available on the free tier first.
  const preferred = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-pro-latest',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-2.5-pro',
    'gemini-2.0-flash-exp-image-generation',
  ];

  const envModel = process.env.GEMINI_MODEL;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  let discovered: string[] = [];
  if (apiKey) {
    try {
      discovered = await discoverGenerateContentModels(apiKey);
    } catch (err) {
      console.warn('Gemini model discovery failed:', err);
    }
  }

  // Put last-known-good model first.
  const ordered = uniqPreserveOrder([
    selectedModelId,
    envModel,
    ...preferred,
    ...discovered,
  ]);

  return ordered;
}

function shouldTryNextModel(err: any): boolean {
  const status = err?.status;
  if (status === 404) return true;
  if (status === 429) return true;

  const msg = String(err?.message || '');
  if (/not found/i.test(msg)) return true;
  if (/quota/i.test(msg) && /exceeded/i.test(msg)) return true;
  return false;
}

/**
 * Evaluate a subjective answer using Gemini AI
 * @param question The question text
 * @param correctAnswer The correct/expected answer
 * @param userAnswer The user's submitted answer
 * @returns A score from 0-100 and feedback
 */
export async function evaluateSubjectiveAnswer(
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<{ score: number; feedback: string; isCorrect: boolean }> {
  try {
    const client = getGenAI();

    const candidateModelIds = await getCandidateModelIds(client);

    console.log(`Evaluating answer... Question: "${question.substring(0, 50)}..."`);

    const prompt = `You are an expert academic grader. Your task is to evaluate a student's answer against the correct answer and assign a score from 0 to 100.

Question: "${question}"

Correct Answer: "${correctAnswer}"

Student's Answer: "${userAnswer}"

Evaluation Criteria:
- 100: Perfect match or equivalent meaning with all key details.
- 80-99: Correct concept but minor missing details or grammar issues.
- 50-79: Partially correct, captures the main idea but misses key context or has some errors.
- 1-49: Vague, mostly incorrect, or very weak answer.
- 0: Completely incorrect, irrelevant, or empty.

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no code blocks) with the following structure:
{
  "score": <number 0-100>,
  "feedback": "<brief, constructive feedback string>",
  "isCorrect": <boolean, true if score >= 50>
}`;

    let lastErr: any;
    let text: string | null = null;
    let usedModelId: string | null = null;

    for (const modelId of candidateModelIds) {
      try {
        const model = client.getGenerativeModel({ model: modelId });
        console.log(`Gemini generateContent using model: ${modelId}`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();
        usedModelId = modelId;
        selectedModelId = modelId; // cache only on success
        break;
      } catch (err: any) {
        lastErr = err;
        if (shouldTryNextModel(err)) {
          continue;
        }
        throw err;
      }
    }

    if (text == null) {
      throw lastErr || new Error('Gemini generateContent failed for all candidate models');
    }

    console.log(`Gemini Raw Response (model: ${usedModelId}):`, text);

    // Clean up potential markdown formatting
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let evaluation: any;
    try {
      evaluation = JSON.parse(jsonStr);
    } catch (parseErr) {
      // Attempt to extract the first JSON object present in the text
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        evaluation = JSON.parse(match[0]);
      } else {
        throw parseErr;
      }
    }

    const rawScore = Number(evaluation.score);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : 0;
    const feedback = typeof evaluation.feedback === 'string' && evaluation.feedback.trim()
      ? evaluation.feedback
      : 'No feedback';

    return {
      score,
      feedback,
      isCorrect: evaluation.isCorrect === true || score >= 50,
    };

  } catch (error: any) {
    console.error('CRITICAL LLM ERROR:', error);

    // Fallback logic (no LLM / LLM error)
    const correctLower = correctAnswer.toLowerCase().trim();
    const userLower = userAnswer.toLowerCase().trim();

    if (correctLower === userLower) {
      return { score: 100, feedback: 'Exact match (Fallback)', isCorrect: true };
    }
    if (userLower && correctLower.includes(userLower) && userLower.length > correctLower.length * 0.5) {
      return { score: 60, feedback: 'Partial match (Fallback)', isCorrect: true };
    }

    return {
      score: 0,
      feedback: `AI Evaluation Failed: ${error?.message || 'Unknown error'}. Falling back to simple comparison.`,
      isCorrect: false,
    };
  }
}

