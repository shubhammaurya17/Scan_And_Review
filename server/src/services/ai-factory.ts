import { IAIService } from './ai.service';
import { OllamaService } from './ollama.service';
import { GroqService } from './groq.service';
import { GeminiService } from './gemini.service';
import { TemplateService } from './template.service';
import { config } from '../config/env';

let currentService: IAIService;
let aiAvailable = false;
let initPromise: Promise<void> | null = null;
let initialized = false;

const templateService = new TemplateService();

async function initProvider(): Promise<void> {
  const provider = config.AI_PROVIDER;
  console.log(`🔧 AI Provider configured: "${provider}"`);

  if (provider === 'gemini' && config.GEMINI_API_KEY) {
    const geminiService = new GeminiService();
    const available = await geminiService.isAvailable();

    if (available) {
      console.log('✅ Gemini is available — using AI-powered generation');
      currentService = geminiService;
      aiAvailable = true;
    } else {
      console.log('⚠️ Gemini is unreachable — falling back to template generation');
      currentService = templateService;
      aiAvailable = false;
    }

    // Re-check Gemini every 60 seconds
    setInterval(async () => {
      const wasAvailable = aiAvailable;
      aiAvailable = await geminiService.isAvailable();

      if (aiAvailable && !wasAvailable) {
        console.log('✅ Gemini is available — using AI-powered generation');
        currentService = geminiService;
      } else if (!aiAvailable && wasAvailable) {
        console.log('⚠️ Gemini is unavailable — falling back to template generation');
        currentService = templateService;
      }
    }, 60000);
  } else if (provider === 'groq' && config.GROQ_API_KEY) {
    const groqService = new GroqService();
    const available = await groqService.isAvailable();

    if (available) {
      console.log('✅ Groq is available — using AI-powered generation');
      currentService = groqService;
      aiAvailable = true;
    } else {
      console.log('⚠️ Groq is unreachable — falling back to template generation');
      currentService = templateService;
      aiAvailable = false;
    }

    // Re-check Groq every 60 seconds
    setInterval(async () => {
      const wasAvailable = aiAvailable;
      aiAvailable = await groqService.isAvailable();

      if (aiAvailable && !wasAvailable) {
        console.log('✅ Groq is available — using AI-powered generation');
        currentService = groqService;
      } else if (!aiAvailable && wasAvailable) {
        console.log('⚠️ Groq is unavailable — falling back to template generation');
        currentService = templateService;
      }
    }, 60000);
  } else if (provider === 'ollama') {
    const ollamaService = new OllamaService();

    async function checkOllama(): Promise<void> {
      const wasAvailable = aiAvailable;
      aiAvailable = await ollamaService.isAvailable();

      if (aiAvailable && !wasAvailable) {
        console.log('✅ Ollama is available — using AI-powered generation');
        currentService = ollamaService;
      } else if (!aiAvailable && wasAvailable) {
        console.log('⚠️ Ollama is unavailable — falling back to template generation');
        currentService = templateService;
      }
    }

    await checkOllama();
    setInterval(() => checkOllama().catch(() => {}), 60000);
  } else {
    if (provider === 'gemini' && !config.GEMINI_API_KEY) {
      console.error('❌ AI_PROVIDER is "gemini" but GEMINI_API_KEY is not set! Falling back to templates.');
    } else if (provider === 'groq' && !config.GROQ_API_KEY) {
      console.error('❌ AI_PROVIDER is "groq" but GROQ_API_KEY is not set! Falling back to templates.');
    } else {
      console.log('📝 Using template-based generation (provider: "' + provider + '")');
    }
    currentService = templateService;
    aiAvailable = false;
  }

  initialized = true;
}

// Initialize — store the promise so getAIService can await it
currentService = templateService;
initPromise = initProvider().catch((err) => {
  console.error('AI provider initialization failed:', err);
  initialized = true;
});

/**
 * Returns the AI service, waiting for initialization to complete on first call.
 * This prevents the race condition where requests arrive before the AI provider
 * has been checked and end up using templates even when Gemini is available.
 */
export async function getAIServiceAsync(): Promise<IAIService> {
  if (!initialized && initPromise) {
    await initPromise;
  }
  console.log(`🤖 AI service in use: ${currentService.constructor.name} (available: ${aiAvailable})`);
  return currentService;
}

/**
 * Synchronous getter — only use this if you're sure initialization is complete.
 * Prefer getAIServiceAsync() in request handlers.
 */
export function getAIService(): IAIService {
  if (!initialized) {
    console.warn('⚠️ getAIService() called before AI provider initialized — may return template service');
  }
  return currentService;
}

export function isAIAvailable(): boolean {
  return aiAvailable;
}

// Keep legacy export for backward compatibility
export const isOllamaAvailable = isAIAvailable;
