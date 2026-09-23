import { IAIService } from './ai.service';
import { OllamaService } from './ollama.service';
import { GroqService } from './groq.service';
import { TemplateService } from './template.service';
import { config } from '../config/env';

let currentService: IAIService;
let aiAvailable = false;

const templateService = new TemplateService();

async function initProvider(): Promise<void> {
  const provider = config.AI_PROVIDER;

  if (provider === 'groq' && config.GROQ_API_KEY) {
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
    // template or unknown provider
    console.log('📝 Using template-based generation');
    currentService = templateService;
    aiAvailable = false;
  }
}

// Initialize
currentService = templateService;
initProvider().catch(() => {});

export function getAIService(): IAIService {
  return currentService;
}

export function isAIAvailable(): boolean {
  return aiAvailable;
}

// Keep legacy export for backward compatibility
export const isOllamaAvailable = isAIAvailable;
