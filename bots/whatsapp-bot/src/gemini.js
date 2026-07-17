/**
 * Gemini AI Client with Automatic Fallback
 *
 * Model priority:
 *   1. gemini-2.5-flash         (primary — fastest, best quality)
 *   2. gemini-2.0-flash-lite    (fallback — lighter, still fast)
 *   3. gemma-3-27b-it           (last resort — open model)
 *
 * On any error (429 rate-limit, 503 overload, network failure, etc.)
 * the next model in the chain is tried automatically.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const MODELS = [
  'gemini-2.5-flash',      // Primary
  'gemini-2.0-flash-lite', // Fallback
  'gemma-3-27b-it',        // Final fallback
];

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('[Gemini] GEMINI_API_KEY is not set. Please add it to your environment secrets.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Generates a response from Gemini, falling back through the model chain on failure.
 *
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history
 *   Previous messages (already in Gemini history format), NOT including the new user message.
 * @param {string} userMessage - The new message from the user.
 * @returns {Promise<{text: string, modelUsed: string}>}
 */
export async function generateResponse(history, userMessage) {
  let lastError;

  for (const modelName of MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
        systemInstruction:
          'You are a helpful, friendly, and concise assistant on WhatsApp. ' +
          'Keep responses short and conversational unless asked for detail. ' +
          'Do not use excessive markdown — plain text works best on WhatsApp.',
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      const text = result.response.text();

      if (modelName !== MODELS[0]) {
        console.log(`[Gemini] ✓ Responded using fallback model: ${modelName}`);
      }

      return { text, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      const status = err?.status ?? err?.code ?? 'unknown';
      console.warn(`[Gemini] Model "${modelName}" failed (${status}): ${err.message}`);

      // Only fall through on retriable / quota errors; re-throw auth errors immediately
      if (err?.status === 401 || err?.status === 403) {
        throw new Error(`[Gemini] Authentication error — check your GEMINI_API_KEY. ${err.message}`);
      }
    }
  }

  throw new Error(`[Gemini] All models failed. Last error: ${lastError?.message}`);
}
