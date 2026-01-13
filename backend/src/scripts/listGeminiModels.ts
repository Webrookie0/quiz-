import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY in environment');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // This repo's SDK version does not expose `genAI.listModels()`, so use REST.
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`ListModels failed: ${resp.status} ${resp.statusText}`);
  }
  const data: any = await resp.json();
  const models: any[] = Array.isArray(data?.models) ? data.models : [];

  const simplified = models.map((m) => ({
    name: m?.name,
    displayName: m?.displayName,
    supportedGenerationMethods: m?.supportedGenerationMethods,
  }));

  console.log(JSON.stringify({ count: simplified.length, models: simplified }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
