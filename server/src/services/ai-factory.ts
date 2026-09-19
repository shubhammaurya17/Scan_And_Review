import { IAIService } from './ai.service';
import { OllamaService } from './ollama.service';
import { TemplateService } from './template.service';

let currentService: IAIService;
let ollamaAvailable = false;

const ollamaService = new OllamaService();
const templateService = new TemplateService();

async function checkOllama(): Promise<void> {
  const wasAvailable = ollamaAvailable;
  ollamaAvailable = await ollamaService.isAvailable();

  if (ollamaAvailable && !wasAvailable) {
    console.log('✅ Ollama is available — using AI-powered generation');
    currentService = ollamaService;
  } else if (!ollamaAvailable && wasAvailable) {
    console.log('⚠️ Ollama is unavailable — falling back to template generation');
    currentService = templateService;
  }
}

// Initial check
currentService = templateService;
checkOllama().catch(() => {});

// Re-check every 60 seconds
setInterval(() => checkOllama().catch(() => {}), 60000);

export function getAIService(): IAIService {
  return currentService;
}

export function isOllamaAvailable(): boolean {
  return ollamaAvailable;
}
